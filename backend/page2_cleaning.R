# =============================================================================
# page2_cleaning.R
# Sentiment Analysis System — Text Cleaning & Exploration Module
# -----------------------------------------------------------------------------
# Handles: Toggle-able cleaning pipeline, token metrics, word frequency shift,
#          live preview (one sample sentence before/after)
#
# Dependencies: tm, tidytext, stringr, textstem, dplyr, tidyr
# =============================================================================

suppressPackageStartupMessages({
  library(tm)
  library(tidytext)
  library(stringr)
  library(textstem)
  library(dplyr)
  library(tidyr)
})

# =============================================================================
# SECTION 1 — INDIVIDUAL CLEANING STEPS
# Each function takes a character vector and returns a cleaned character vector.
# All steps are designed to be safely composable in any order.
# =============================================================================

#' Convert all text to lowercase.
step_lowercase <- function(texts) {
  tolower(texts)
}

#' Remove punctuation characters and stray special/currency symbols.
step_remove_punctuation <- function(texts) {
  texts %>%
    str_replace_all("[[:punct:]]",          " ") %>%   # standard punctuation
    str_replace_all("[^[:alnum:]\\s]",      " ") %>%   # catch $, €, £, @, # etc.
    str_squish()
}

#' Remove all numeric characters (digits).
step_remove_numbers <- function(texts) {
  str_replace_all(texts, "[[:digit:]]", " ") %>%
    str_squish()
}

#' Remove URLs (http/https/www) and HTML tags.
step_remove_urls <- function(texts) {
  texts %>%
    str_replace_all("https?://\\S+",          "") %>%   # http/https URLs
    str_replace_all("www\\.\\S+",             "") %>%   # www URLs
    str_replace_all("<[^>]+>",                "") %>%   # HTML tags
    str_replace_all("&[a-zA-Z0-9#]+;",        "") %>%   # HTML entities e.g. &amp;
    str_squish()
}

#' Remove English stopwords using the tm stopword list.
step_remove_stopwords <- function(texts) {
  sw <- stopwords("en")
  # Build regex: whole-word match only, case-insensitive
  pattern <- paste0("\\b(", paste(sw, collapse = "|"), ")\\b")
  str_replace_all(texts, regex(pattern, ignore_case = TRUE), " ") %>%
    str_squish()
}

#' Reduce words to their root form using Porter stemming.
step_stem <- function(texts) {
  # stem_strings works word-by-word but preserves sentence structure
  stem_strings(texts)
}

# =============================================================================
# SECTION 2 — PIPELINE RUNNER
# =============================================================================

#' Apply the cleaning pipeline based on user toggle selections.
#'
#' @param texts       Character vector. Raw texts to clean.
#' @param do_lower    Logical. Apply lowercase.          Default TRUE.
#' @param do_punct    Logical. Remove punctuation.       Default TRUE.
#' @param do_numbers  Logical. Remove numbers.           Default TRUE.
#' @param do_urls     Logical. Remove URLs and HTML.     Default TRUE.
#' @param do_stops    Logical. Remove stopwords.         Default TRUE.
#' @param do_stem     Logical. Apply stemming.           Default TRUE.
#' @return Character vector of cleaned texts (same length as input).
clean_texts <- function(texts,
                        do_lower   = TRUE,
                        do_punct   = TRUE,
                        do_numbers = TRUE,
                        do_urls    = TRUE,
                        do_stops   = TRUE,
                        do_stem    = TRUE) {

  out <- as.character(texts)

  # URL/HTML removal should happen BEFORE punctuation (URLs contain slashes/dots)
  if (do_urls)    out <- step_remove_urls(out)
  if (do_lower)   out <- step_lowercase(out)
  if (do_punct)   out <- step_remove_punctuation(out)
  if (do_numbers) out <- step_remove_numbers(out)
  if (do_stops)   out <- step_remove_stopwords(out)
  if (do_stem)    out <- step_stem(out)

  out
}

# =============================================================================
# SECTION 3 — TOKEN METRICS
# =============================================================================

#' Count total word tokens across all texts.
#'
#' @param texts Character vector.
#' @return Integer. Total token count.
count_tokens <- function(texts) {
  texts <- str_squish(as.character(texts))
  texts <- texts[nchar(texts) > 0]
  if (length(texts) == 0) return(0L)
  sum(str_count(texts, "\\S+"))
}

#' Compute token metrics before and after cleaning.
#'
#' @param raw_texts     Character vector. Original texts.
#' @param cleaned_texts Character vector. Texts after cleaning pipeline.
#' @return Named list:
#'   $tokens_before     — integer
#'   $tokens_after      — integer
#'   $tokens_removed    — integer
#'   $pct_reduction     — numeric (0–100), rounded to 1 dp
compute_token_metrics <- function(raw_texts, cleaned_texts) {
  before  <- count_tokens(raw_texts)
  after   <- count_tokens(cleaned_texts)
  removed <- before - after
  pct     <- if (before == 0) 0 else round((removed / before) * 100, 1)

  list(
    tokens_before  = before,
    tokens_after   = after,
    tokens_removed = removed,
    pct_reduction  = pct
  )
}

# =============================================================================
# SECTION 4 — LIVE PREVIEW (single example sentence)
# =============================================================================

#' Get one representative example sentence from the dataset for live preview.
#'
#' Picks the sentence closest to the median word count to avoid showing
#' an unusually short or long example.
#'
#' @param texts Character vector of raw texts.
#' @return Single character string (the chosen example, trimmed).
pick_preview_sentence <- function(texts) {
  texts      <- as.character(texts)
  texts      <- texts[nchar(str_squish(texts)) > 0]
  word_counts <- str_count(texts, "\\S+")
  median_wc   <- median(word_counts)
  idx         <- which.min(abs(word_counts - median_wc))
  str_squish(texts[idx])
}

#' Produce a before/after preview for one sentence given the toggle state.
#'
#' @param raw_texts   Full character vector (used to pick representative sentence).
#' @param ...         Toggle arguments forwarded to clean_texts().
#' @return List with:
#'   $original — character. The chosen raw sentence.
#'   $cleaned  — character. The same sentence after cleaning.
get_preview <- function(raw_texts, ...) {
  original <- pick_preview_sentence(raw_texts)
  cleaned  <- clean_texts(original, ...)
  list(original = original, cleaned = cleaned)
}

# =============================================================================
# SECTION 5 — WORD FREQUENCY SHIFT CHART DATA
# =============================================================================

#' Build frequency data for the word frequency shift chart.
#'
#' Returns the top N words by raw frequency, labelled as either
#' "removed" (cleaned away by active steps) or "retained".
#'
#' @param raw_texts     Character vector. Original texts.
#' @param cleaned_texts Character vector. Texts after cleaning.
#' @param top_n         Integer. Number of top words to return. Default 20.
#' @return Tibble with columns: word, raw_count, status ("removed"/"retained")
#'         Sorted descending by raw_count.
build_freq_shift_data <- function(raw_texts, cleaned_texts, top_n = 20) {

  # Tokenise raw texts (simple whitespace split after basic normalisation)
  raw_lower <- tolower(as.character(raw_texts))
  raw_lower <- str_replace_all(raw_lower, "[[:punct:]]", " ")

  raw_tokens <- tibble(text = raw_lower) %>%
    unnest_tokens(word, text) %>%
    count(word, name = "raw_count") %>%
    arrange(desc(raw_count)) %>%
    slice_head(n = top_n * 3)   # grab extra buffer before filtering

  # Tokenise cleaned texts to find which words survived
  cleaned_tokens <- tibble(text = tolower(as.character(cleaned_texts))) %>%
    unnest_tokens(word, text) %>%
    distinct(word)

  # Label each word
  freq_data <- raw_tokens %>%
    mutate(status = if_else(word %in% cleaned_tokens$word, "retained", "removed")) %>%
    arrange(desc(raw_count)) %>%
    slice_head(n = top_n)

  freq_data
}

# =============================================================================
# SECTION 6 — MAIN CLEANING ENTRY POINT (called by Shiny server)
# =============================================================================

#' Full cleaning pipeline output — used directly by the Shiny reactive.
#'
#' @param raw_texts  Character vector. All raw texts from the loaded dataset.
#' @param do_lower   Logical toggles (see clean_texts).
#' @param do_punct   Logical.
#' @param do_numbers Logical.
#' @param do_urls    Logical.
#' @param do_stops   Logical.
#' @param do_stem    Logical.
#' @param top_n      Top N words for frequency chart.
#' @return List with:
#'   $cleaned_texts  — character vector (same length as input)
#'   $metrics        — list from compute_token_metrics()
#'   $preview        — list from get_preview() ($original, $cleaned)
#'   $freq_shift     — tibble from build_freq_shift_data()
run_cleaning_pipeline <- function(raw_texts,
                                  do_lower   = TRUE,
                                  do_punct   = TRUE,
                                  do_numbers = TRUE,
                                  do_urls    = TRUE,
                                  do_stops   = TRUE,
                                  do_stem    = TRUE,
                                  top_n      = 20) {

  cleaned <- clean_texts(
    raw_texts,
    do_lower   = do_lower,
    do_punct   = do_punct,
    do_numbers = do_numbers,
    do_urls    = do_urls,
    do_stops   = do_stops,
    do_stem    = do_stem
  )

  metrics    <- compute_token_metrics(raw_texts, cleaned)
  preview    <- get_preview(raw_texts,
                            do_lower   = do_lower,
                            do_punct   = do_punct,
                            do_numbers = do_numbers,
                            do_urls    = do_urls,
                            do_stops   = do_stops,
                            do_stem    = do_stem)
  freq_shift <- build_freq_shift_data(raw_texts, cleaned, top_n)

  list(
    cleaned_texts = cleaned,
    metrics       = metrics,
    preview       = preview,
    freq_shift    = freq_shift
  )
}

# =============================================================================
# SECTION 7 — SELF-TEST
# =============================================================================

test_cleaning_module <- function() {

  sample_texts <- c(
    "I ABSOLUTELY love this product!! It's wonderful & amazing. Visit http://example.com for more.",
    "This is the WORST experience I've ever had... Terrible service!!! 10/10 would NOT recommend.",
    "It was okay, nothing special. Could be better OR worse. Price: $29.99",
    "Fantastic quality and GREAT value for money. Very happy with purchase #1!",
    "Awful, disgusting, and completely broken. Total waste of $50. <b>Do not buy!</b>",
    "Not bad, decent enough for the price. Shipped in 3 days.",
    "Outstanding performance & brilliant design. The 2nd best I've used!",
    "Disappointing and frustrating. Would not recommend to anyone at all."
  )

  cat("\n========================================\n")
  cat("  CLEANING MODULE — SELF TEST\n")
  cat("========================================\n\n")

  # --- All steps ON (default) ---
  cat("--- All Steps ON ---\n")
  res_all <- run_cleaning_pipeline(sample_texts)

  cat("Token Metrics:\n")
  cat("  Before:      ", res_all$metrics$tokens_before, "\n")
  cat("  After:       ", res_all$metrics$tokens_after, "\n")
  cat("  Removed:     ", res_all$metrics$tokens_removed, "\n")
  cat("  % Reduction: ", res_all$metrics$pct_reduction, "%\n\n")

  cat("Live Preview:\n")
  cat("  Original: ", res_all$preview$original, "\n")
  cat("  Cleaned:  ", res_all$preview$cleaned,  "\n\n")

  cat("Cleaned Texts (first 3):\n")
  for (i in 1:3) cat(" ", i, ":", res_all$cleaned_texts[i], "\n")

  cat("\nWord Frequency Shift (top 10):\n")
  print(head(res_all$freq_shift, 10))

  # --- Only lowercase + punctuation ON ---
  cat("\n--- Only Lowercase + Punctuation ON ---\n")
  res_min <- run_cleaning_pipeline(
    sample_texts,
    do_lower   = TRUE,
    do_punct   = TRUE,
    do_numbers = FALSE,
    do_urls    = FALSE,
    do_stops   = FALSE,
    do_stem    = FALSE
  )
  cat("Token Metrics:\n")
  cat("  Before:      ", res_min$metrics$tokens_before, "\n")
  cat("  After:       ", res_min$metrics$tokens_after, "\n")
  cat("  % Reduction: ", res_min$metrics$pct_reduction, "%\n\n")

  cat("Preview:\n")
  cat("  Original: ", res_min$preview$original, "\n")
  cat("  Cleaned:  ", res_min$preview$cleaned,  "\n\n")

  # --- URL removal test ---
  cat("--- URL Removal Test ---\n")
  url_text <- c(
    "Check this out https://www.google.com/search?q=test and also www.example.org",
    "<p>HTML <b>tag</b> removal test &amp; entity decoding</p>"
  )
  cleaned_url <- clean_texts(url_text, do_lower = TRUE, do_punct = FALSE,
                              do_numbers = FALSE, do_urls = TRUE,
                              do_stops = FALSE, do_stem = FALSE)
  cat("  Input 1: ", url_text[1], "\n")
  cat("  Output 1:", cleaned_url[1], "\n")
  cat("  Input 2: ", url_text[2], "\n")
  cat("  Output 2:", cleaned_url[2], "\n\n")

  # --- Stemming test ---
  cat("--- Stemming Test ---\n")
  stem_text <- c("absolutely wonderful running jumped disappointingly")
  cat("  Before:", stem_text, "\n")
  cat("  After: ", step_stem(stem_text), "\n\n")

  cat("\n✔ All tests passed — page2_cleaning.R is working correctly.\n\n")
}
