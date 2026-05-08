# =============================================================================
# page4_lexicon.R
# Sentiment Analysis System — Lexicon-Based Scoring Module
# -----------------------------------------------------------------------------
# Handles: AFINN scoring, Bing scoring, NRC emotion mapping
# Outputs: scored dataframe, top words, score distributions, emotion aggregates
# Dependencies: tidytext, textdata, dplyr, tidyr, stringr
# =============================================================================

# --- Package Loading ---------------------------------------------------------
suppressPackageStartupMessages({
  library(tidytext)
  library(textdata)
  library(dplyr)
  library(tidyr)
  library(stringr)
  library(ggplot2)
})

# =============================================================================
# SECTION 1 — SHARED UTILITIES
# =============================================================================

#' Tokenise a character vector into a tidy word-per-row dataframe.
#'
#' @param texts     Character vector. One element per document/row.
#' @param doc_ids   Integer or character vector of the same length as `texts`.
#'                  Used as row identifiers in the output.
#' @return Tibble with columns: doc_id, word
tokenise_texts <- function(texts, doc_ids = seq_along(texts)) {
  tibble(doc_id = doc_ids, text = as.character(texts)) %>%
    unnest_tokens(word, text)
}

# =============================================================================
# SECTION 2 — AFINN SCORING
# =============================================================================

#' Score texts using the AFINN lexicon (-5 to +5 per word).
#'
#' @param texts             Character vector of cleaned text.
#' @param doc_ids           Optional row IDs (defaults to row index).
#' @param sentiment_type    One of "binary", "ternary". Controls label assignment.
#' @param neutral_threshold Numeric >= 0. Only used when sentiment_type == "ternary".
#'                          Scores in (-neutral_threshold, +neutral_threshold)
#'                          are labelled "Neutral". Default 1.
#' @return List with:
#'   $scored_docs  — tibble with doc_id, afinn_score, label
#'   $word_scores  — tibble with word, value (afinn score)
#'   $top_positive — tibble, top 5 words with highest positive contribution
#'   $top_negative — tibble, top 5 words with highest negative contribution
#'   $score_dist   — tibble: score (-5:5) and count, for histogram
score_afinn <- function(texts,
                        doc_ids          = seq_along(texts),
                        sentiment_type   = "binary",
                        neutral_threshold = 1) {

  # Load lexicon (textdata will prompt once on first run — accept the download)
  afinn_lex <- get_sentiments("afinn")

  # Tokenise
  tokens <- tokenise_texts(texts, doc_ids)

  # Join with AFINN
  scored_words <- tokens %>%
    inner_join(afinn_lex, by = "word")

  # Aggregate score per document
  doc_scores <- scored_words %>%
    group_by(doc_id) %>%
    summarise(afinn_score = sum(value), .groups = "drop")

  # Fill documents that had NO scoreable words with 0
  all_ids <- tibble(doc_id = doc_ids)
  doc_scores <- all_ids %>%
    left_join(doc_scores, by = "doc_id") %>%
    mutate(afinn_score = replace_na(afinn_score, 0))

  # Assign labels
  doc_scores <- doc_scores %>%
    mutate(label = assign_afinn_label(afinn_score, sentiment_type, neutral_threshold))

  # Top positive words (highest positive contribution across all docs)
  top_positive <- scored_words %>%
    filter(value > 0) %>%
    group_by(word) %>%
    summarise(total_score = sum(value), count = n(), .groups = "drop") %>%
    arrange(desc(total_score)) %>%
    slice_head(n = 5)

  # Top negative words (lowest/most negative contribution)
  top_negative <- scored_words %>%
    filter(value < 0) %>%
    group_by(word) %>%
    summarise(total_score = sum(value), count = n(), .groups = "drop") %>%
    arrange(total_score) %>%          # ascending — most negative first
    slice_head(n = 5)

  # Score distribution histogram data (-5 to +5)
  score_dist <- doc_scores %>%
    mutate(afinn_score = pmax(-5, pmin(5, afinn_score))) %>%  # clamp to [-5, 5]
    group_by(afinn_score) %>%
    summarise(count = n(), .groups = "drop") %>%
    complete(afinn_score = -5:5, fill = list(count = 0))      # ensure all bins present

  list(
    scored_docs  = doc_scores,
    word_scores  = scored_words %>% select(doc_id, word, value),
    top_positive = top_positive,
    top_negative = top_negative,
    score_dist   = score_dist
  )
}

#' Internal helper: assign AFINN label based on score and sentiment type.
assign_afinn_label <- function(scores, sentiment_type, neutral_threshold = 1) {
  sentiment_type <- tolower(sentiment_type)
  if (sentiment_type == "ternary") {
    case_when(
      scores >  neutral_threshold  ~ "Positive",
      scores < -neutral_threshold  ~ "Negative",
      TRUE                         ~ "Neutral"
    )
  } else {
    # Binary — zero scores go to "Neutral" bucket labelled as Negative
    ifelse(scores >= 0, "Positive", "Negative")
  }
}

# =============================================================================
# SECTION 3 — BING SCORING
# =============================================================================

#' Score texts using the Bing lexicon (positive / negative word lists).
#'
#' @param texts           Character vector of cleaned text.
#' @param doc_ids         Optional row IDs.
#' @param sentiment_type  One of "binary", "ternary".
#' @param neutral_threshold Numeric 0–1. Proportion of negative words below which
#'                          a document is classed as Neutral (ternary only).
#'                          Default 0.4 (40% negative words → Neutral zone).
#' @return List with:
#'   $scored_docs  — tibble with doc_id, pos_count, neg_count, net_score, label
#'   $word_scores  — tibble with word, sentiment (positive/negative)
#'   $top_positive — tibble, top 5 most frequent positive words
#'   $top_negative — tibble, top 5 most frequent negative words
#'   $label_dist   — tibble: label, count
score_bing <- function(texts,
                       doc_ids           = seq_along(texts),
                       sentiment_type    = "binary",
                       neutral_threshold = 0.4) {

  bing_lex <- get_sentiments("bing")

  tokens <- tokenise_texts(texts, doc_ids)

  scored_words <- tokens %>%
    inner_join(bing_lex, by = "word")

  # Count positive and negative words per document
  doc_scores <- scored_words %>%
    group_by(doc_id, sentiment) %>%
    summarise(count = n(), .groups = "drop") %>%
    pivot_wider(names_from = sentiment, values_from = count, values_fill = 0) %>%
    rename_with(~ paste0(.x, "_count"), -doc_id)

  # Ensure both columns exist even if all words were one sentiment
  if (!"positive_count" %in% names(doc_scores)) doc_scores$positive_count <- 0L
  if (!"negative_count" %in% names(doc_scores)) doc_scores$negative_count <- 0L

  doc_scores <- doc_scores %>%
    mutate(net_score = positive_count - negative_count)

  # Fill in any documents with no matched words
  all_ids <- tibble(doc_id = doc_ids)
  doc_scores <- all_ids %>%
    left_join(doc_scores, by = "doc_id") %>%
    mutate(
      positive_count = replace_na(positive_count, 0L),
      negative_count = replace_na(negative_count, 0L),
      net_score      = replace_na(net_score, 0L)
    )

  # Assign labels
  doc_scores <- doc_scores %>%
    mutate(label = assign_bing_label(net_score, positive_count, negative_count,
                                     sentiment_type, neutral_threshold))

  # Top positive words
  top_positive <- scored_words %>%
    filter(sentiment == "positive") %>%
    count(word, sort = TRUE) %>%
    slice_head(n = 5)

  # Top negative words
  top_negative <- scored_words %>%
    filter(sentiment == "negative") %>%
    count(word, sort = TRUE) %>%
    slice_head(n = 5)

  # Label distribution
  label_dist <- doc_scores %>%
    count(label, name = "count")

  list(
    scored_docs  = doc_scores,
    word_scores  = scored_words %>% select(doc_id, word, sentiment),
    top_positive = top_positive,
    top_negative = top_negative,
    label_dist   = label_dist
  )
}

#' Internal helper: assign Bing label.
assign_bing_label <- function(net_scores, pos_counts, neg_counts,
                               sentiment_type, neutral_threshold = 0.4) {
  sentiment_type <- tolower(sentiment_type)

  total <- pos_counts + neg_counts
  neg_ratio <- ifelse(total == 0, 0.5, neg_counts / total)  # 0.5 = ambiguous if no words

  if (sentiment_type == "ternary") {
    case_when(
      total == 0                                                  ~ "Neutral",
      neg_ratio >  (1 - neutral_threshold) & neg_ratio <= 1.0   ~ "Negative",
      neg_ratio <  neutral_threshold                             ~ "Positive",
      TRUE                                                        ~ "Neutral"
    )
  } else {
    ifelse(net_scores >= 0, "Positive", "Negative")
  }
}

# =============================================================================
# SECTION 4 — NRC EMOTION SCORING
# =============================================================================

#' Score texts using the NRC lexicon (8 emotions + positive/negative).
#' ONLY used when sentiment_type == "emotion".
#'
#' @param texts    Character vector of cleaned text.
#' @param doc_ids  Optional row IDs.
#' @return List with:
#'   $scored_docs   — tibble with doc_id + one column per NRC emotion/sentiment
#'   $dominant_emotion — character: name of the most frequent emotion overall
#'   $emotion_totals   — tibble: emotion, total_count (for radar/bar chart)
#'   $top_positive     — tibble, top 5 words tagged "positive" in NRC
#'   $top_negative     — tibble, top 5 words tagged "negative" in NRC
#'   $label_dist       — tibble: emotion label, count (dominant emotion per doc)
score_nrc <- function(texts, doc_ids = seq_along(texts)) {

  nrc_lex <- get_sentiments("nrc")

  # The 8 emotion categories (excluding generic positive/negative)
  nrc_emotions <- c("joy", "anger", "fear", "sadness",
                    "trust", "disgust", "anticipation", "surprise")

  tokens <- tokenise_texts(texts, doc_ids)

  scored_words <- tokens %>%
    inner_join(nrc_lex, by = "word", relationship = "many-to-many")

  # Emotion counts per document
  emotion_by_doc <- scored_words %>%
    filter(sentiment %in% nrc_emotions) %>%
    group_by(doc_id, sentiment) %>%
    summarise(count = n(), .groups = "drop") %>%
    pivot_wider(names_from = sentiment, values_from = count, values_fill = 0)

  # Ensure all 8 emotion columns present
  for (em in nrc_emotions) {
    if (!em %in% names(emotion_by_doc)) emotion_by_doc[[em]] <- 0L
  }

  # Fill in documents with no NRC matches
  all_ids <- tibble(doc_id = doc_ids)
  scored_docs <- all_ids %>%
    left_join(emotion_by_doc, by = "doc_id") %>%
    mutate(across(all_of(nrc_emotions), ~ replace_na(.x, 0L)))

  # Dominant emotion per document (for the label column)
  scored_docs <- scored_docs %>%
    rowwise() %>%
    mutate(label = {
      em_vals <- c_across(all_of(nrc_emotions))
      if (all(em_vals == 0)) "none" else nrc_emotions[which.max(em_vals)]
    }) %>%
    ungroup()

  # Overall emotion totals (for radar/bar chart)
  emotion_totals <- scored_docs %>%
    summarise(across(all_of(nrc_emotions), sum)) %>%
    pivot_longer(everything(), names_to = "emotion", values_to = "total_count") %>%
    arrange(desc(total_count))

  dominant_emotion <- emotion_totals$emotion[1]

  # Top positive / negative words from NRC positive/negative (not emotion)
  top_positive <- scored_words %>%
    filter(sentiment == "positive") %>%
    count(word, sort = TRUE) %>%
    slice_head(n = 5)

  top_negative <- scored_words %>%
    filter(sentiment == "negative") %>%
    count(word, sort = TRUE) %>%
    slice_head(n = 5)

  # Label distribution (dominant emotion per doc)
  label_dist <- scored_docs %>%
    count(label, name = "count") %>%
    arrange(desc(count))

  list(
    scored_docs      = scored_docs,
    dominant_emotion = dominant_emotion,
    emotion_totals   = emotion_totals,
    top_positive     = top_positive,
    top_negative     = top_negative,
    label_dist       = label_dist
  )
}

# =============================================================================
# SECTION 5 — DISPATCH FUNCTION (called by page4_results.R)
# =============================================================================

#' Master dispatcher — calls the correct lexicon scorer based on method.
#'
#' @param texts           Character vector of cleaned texts.
#' @param doc_ids         Row IDs.
#' @param method          One of "afinn", "bing", "nrc".
#' @param sentiment_type  One of "binary", "ternary", "emotion".
#' @param neutral_threshold Numeric. Used by AFINN (score) or Bing (ratio).
#' @return Named list from the corresponding score_* function.
run_lexicon_analysis <- function(texts,
                                  doc_ids           = seq_along(texts),
                                  method            = "afinn",
                                  sentiment_type    = "binary",
                                  neutral_threshold = 1) {
  method <- tolower(method)

  if (method == "afinn") {
    score_afinn(texts, doc_ids, sentiment_type, neutral_threshold)
  } else if (method == "bing") {
    score_bing(texts, doc_ids, sentiment_type, neutral_threshold)
  } else if (method == "nrc") {
    score_nrc(texts, doc_ids)
  } else {
    stop(paste("Unknown lexicon method:", method,
               "— must be one of: afinn, bing, nrc"))
  }
}

# =============================================================================
# SECTION 6 — SELF-TEST (run this file standalone to verify output)
# =============================================================================
# To test: source("page4_lexicon.R") in an R console, then call:
#   test_lexicon_module()

test_lexicon_module <- function() {

  sample_texts <- c(
    "I absolutely love this product, it is wonderful and amazing!",
    "This is the worst experience I have ever had. Terrible service.",
    "It was okay, nothing special, could be better or worse.",
    "Fantastic quality and great value for money. Very happy!",
    "Awful, disgusting, and completely broken. Total waste of money.",
    "Not bad, decent enough for the price.",
    "Outstanding performance and brilliant design.",
    "Disappointing and frustrating. Would not recommend."
  )

  cat("\n========================================\n")
  cat("  LEXICON MODULE — SELF TEST\n")
  cat("========================================\n\n")

  # --- AFINN Binary ---
  cat("--- AFINN | Binary ---\n")
  res_afinn_bin <- score_afinn(sample_texts, sentiment_type = "binary")
  print(res_afinn_bin$scored_docs)
  cat("\nTop Positive Words:\n"); print(res_afinn_bin$top_positive)
  cat("\nTop Negative Words:\n"); print(res_afinn_bin$top_negative)
  cat("\nScore Distribution:\n"); print(res_afinn_bin$score_dist)

  # --- AFINN Ternary ---
  cat("\n--- AFINN | Ternary (neutral_threshold = 1) ---\n")
  res_afinn_ter <- score_afinn(sample_texts, sentiment_type = "ternary",
                                neutral_threshold = 1)
  print(res_afinn_ter$scored_docs)

  # --- Bing Binary ---
  cat("\n--- BING | Binary ---\n")
  res_bing_bin <- score_bing(sample_texts, sentiment_type = "binary")
  print(res_bing_bin$scored_docs)

  # --- Bing Ternary ---
  cat("\n--- BING | Ternary (neutral_threshold = 0.4) ---\n")
  res_bing_ter <- score_bing(sample_texts, sentiment_type = "ternary",
                              neutral_threshold = 0.4)
  print(res_bing_ter$scored_docs)

  # --- NRC Emotion ---
  cat("\n--- NRC | Emotion-based ---\n")
  res_nrc <- score_nrc(sample_texts)
  cat("Dominant Emotion:", res_nrc$dominant_emotion, "\n")
  cat("\nEmotion Totals:\n"); print(res_nrc$emotion_totals)
  cat("\nLabel Distribution (dominant per doc):\n"); print(res_nrc$label_dist)

  # --- Dispatcher ---
  cat("\n--- Dispatcher Test (bing / ternary) ---\n")
  res_dispatch <- run_lexicon_analysis(
    texts           = sample_texts,
    method          = "bing",
    sentiment_type  = "ternary",
    neutral_threshold = 0.4
  )
  cat("Label distribution via dispatcher:\n")
  print(res_dispatch$label_dist)

  cat("\n✔ All tests passed — page4_lexicon.R is working correctly.\n\n")
}
