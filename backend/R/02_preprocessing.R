# 02_preprocessing.R
# Handles text cleaning, normalization, and missing data strategies.

library(stringr)
library(dplyr)

#' Handle missing text in specified columns
#' @param df Dataframe
#' @param columns Character vector of target columns
#' @param strategy String: "deletion" or "skip"
#' @return Dataframe with missing handled
handle_missing_text <- function(df, columns, strategy) {
  if (is.null(df) || length(columns) == 0) return(df)
  
  if (strategy == "deletion") {
    # Keep row if ALL target columns are not NA and not empty
    for (col in columns) {
      df <- df %>%
        filter(!is.na(.data[[col]]) & str_trim(.data[[col]]) != "")
    }
  } else if (strategy == "skip") {
    missing_mask <- rep(FALSE, nrow(df))
    for (col in columns) {
      missing_mask <- missing_mask | (is.na(df[[col]]) | str_trim(df[[col]]) == "")
    }
    for (col in columns) {
      df[[col]][missing_mask] <- "[No Review]"
    }
  }
  
  return(df)
}

#' Remove URLs and HTML tags
remove_urls_html <- function(text) {
  res <- str_replace_all(text, "<[^>]*>?", " ")
  res <- str_replace_all(res, "(https?:\\/\\/[^\\s]+)", " ")
  res <- str_replace_all(res, "(www\\.[^\\s]+)", " ")
  res <- str_squish(res) # Collapses multiple spaces to single space
  return(res)
}

#' Convert to lowercase
convert_lowercase <- function(text) {
  return(tolower(text))
}

#' Expand common English contractions into their full forms.
#' This preserves negation signals (e.g. "not") which are critical
#' for downstream sentiment analysis.
#' Must run BEFORE punctuation removal (needs the apostrophe intact)
#' and BEFORE stopword removal (so expanded words can be filtered).
expand_contractions <- function(text) {
  # Order matters: longer/more specific patterns first to avoid partial matches
  contractions <- c(
    "won't"      = "will not",
    "can't"      = "cannot",
    "shan't"     = "shall not",
    "n't"        = " not",       # covers don't, didn't, isn't, wasn't, couldn't, etc.
    "i'm"        = "i am",
    "you're"     = "you are",
    "we're"      = "we are",
    "they're"    = "they are",
    "he's"       = "he is",
    "she's"      = "she is",
    "it's"       = "it is",
    "that's"     = "that is",
    "there's"    = "there is",
    "here's"     = "here is",
    "what's"     = "what is",
    "who's"      = "who is",
    "how's"      = "how is",
    "where's"    = "where is",
    "let's"      = "let us",
    "i've"       = "i have",
    "you've"     = "you have",
    "we've"      = "we have",
    "they've"    = "they have",
    "i'll"       = "i will",
    "you'll"     = "you will",
    "he'll"      = "he will",
    "she'll"     = "she will",
    "we'll"      = "we will",
    "they'll"    = "they will",
    "i'd"        = "i would",
    "you'd"      = "you would",
    "he'd"       = "he would",
    "she'd"      = "she would",
    "we'd"       = "we would",
    "they'd"     = "they would",
    "'s"         = "",            # possessive or remaining 's — just strip
    "'re"        = " are",
    "'ve"        = " have",
    "'ll"        = " will",
    "'d"         = " would",
    "'m"         = " am"
  )

  res <- text
  for (pattern in names(contractions)) {
    replacement <- contractions[[pattern]]
    # Use fixed matching for apostrophe patterns — no regex needed
    # Handle all three apostrophe variants found in real datasets:
    #   ' (straight apostrophe, U+0027)
    #   \u2019 (right single curly quote, common in Word/smart-quote text)
    #   ` (backtick/grave accent, U+0060, often used in informal text)
    res <- str_replace_all(res, fixed(pattern), replacement)
    curly_pattern <- gsub("'", "\u2019", pattern)
    res <- str_replace_all(res, fixed(curly_pattern), replacement)
    backtick_pattern <- gsub("'", "`", pattern)
    res <- str_replace_all(res, fixed(backtick_pattern), replacement)
  }
  res <- str_squish(res)
  return(res)
}

#' Remove punctuation (expanded to cover common Unicode variants)
remove_punctuation <- function(text) {
  # Standard ASCII punctuation: . , ; : ? ! ' " - ( ) [ ] { }
  # Plus Unicode: ellipsis (…), em-dash (—), en-dash (–), curly quotes (" " ' ')
  res <- str_replace_all(text, "[.,;:?!'\"()\\[\\]{}\\-\u2026\u2014\u2013\u201C\u201D\u2018\u2019]", " ")
  res <- str_squish(res)
  return(res)
}

#' Remove special characters
remove_special_chars <- function(text) {
  # Matches @ # $ % ^ & * _ = + ~ ` | \ / < >
  res <- str_replace_all(text, "[@#$%^&*_=+~`|\\\\/><]", " ")
  res <- str_squish(res)
  return(res)
}

#' Remove numbers
remove_numbers <- function(text) {
  res <- str_replace_all(text, "[0-9]+", " ")
  res <- str_squish(res)
  return(res)
}

#' Remove stopwords — sentiment-analysis-safe list.
#' Based on the standard SMART stopword list but with critical exclusions:
#'   - "not", "no", "nor" are KEPT (negation signals essential for sentiment)
#'   - "like" is KEPT (carries direct sentiment meaning: "I like this")
#' Removing negation words would invert meaning:
#'   "I do not like" → "like"  (wrong!)
#'   "not good"      → "good"  (wrong!)
remove_stopwords <- function(text) {
  stops <- c(
    # Articles & determiners
    "a", "an", "the", "this", "that", "these", "those",
    # Pronouns
    "i", "me", "my", "myself", "we", "our", "ours", "ourselves",
    "you", "your", "yours", "yourself", "yourselves",
    "he", "him", "his", "himself",
    "she", "her", "hers", "herself",
    "it", "its", "itself",
    "they", "them", "their", "theirs", "themselves",
    # Prepositions & conjunctions
    "in", "on", "at", "to", "for", "of", "with", "by",
    "from", "up", "about", "into", "through", "during",
    "before", "after", "above", "below", "between",
    "out", "off", "over", "under", "again", "further",
    "then", "once", "and", "but", "or", "so", "yet",
    # Be verbs
    "am", "is", "are", "was", "were", "be", "been", "being",
    # Have verbs
    "has", "have", "had", "having",
    # Do verbs
    "do", "does", "did", "doing",
    # Modal verbs
    "will", "would", "shall", "should",
    "can", "could", "may", "might", "must",
    # NOTE: "not", "no", "nor" intentionally EXCLUDED — negation is critical
    #       for sentiment analysis ("not good" ≠ "good")
    # NOTE: "like" intentionally EXCLUDED — it carries sentiment
    #       ("I like this" should not become empty)
    # Question / relative words
    "what", "which", "who", "whom", "when", "where", "why", "how",
    # Quantifiers & other function words
    "all", "each", "every", "both", "few", "more", "most",
    "other", "some", "such", "only", "own", "same",
    "than", "too", "very",
    "just", "because", "as", "until", "while",
    "if", "else", "also", "here", "there",
    "any", "many", "much", "now",
    "well", "way", "even", "new",
    "use", "used",
    "make",
    "going", "know", "take",
    "come", "get", "go", "got",
    "need", "think", "see", "look",
    "give", "tell", "say", "said",
    "one", "two",
    "back", "still",
    "right", "around",
    "down", "another",
    "however", "really",
    "since", "whether",
    "enough", "already",
    "though", "although",
    "let"
  )

  # Remove duplicates
  stops <- unique(stops)

  # Create a regex pattern matching whole words only (case-insensitive)
  pattern <- paste0("\\b(", paste(stops, collapse = "|"), ")\\b")
  
  res <- str_replace_all(text, regex(pattern, ignore_case = TRUE), " ")
  res <- str_squish(res)
  
  return(res)
}

#' Apply full text transformation pipeline to a string vector
#' @param text Character vector
#' @param config List of boolean toggles matching frontend
#'
#' Pipeline order:
#'   1. Remove URLs/HTML      (clean noise before any text processing)
#'   2. Lowercase             (normalize case for all downstream steps)
#'   3. Expand contractions   (always runs — split contractions into words)
#'   4. Remove stopwords      (runs on intact words, before punctuation strips them)
#'   5. Remove punctuation    (safe to strip now that contractions/stopwords are handled)
#'   6. Remove special chars
#'   7. Remove numbers
transform_text <- function(text, config) {
  res <- as.character(text)
  
  # Handle NA
  res[is.na(res)] <- ""
  
  # 1. Remove URLs and HTML first (removes noise before text processing)
  if (isTRUE(config$removeUrlsHtml)) {
    res <- remove_urls_html(res)
  }

  # 2. Lowercase (normalize case for all downstream matching)
  if (isTRUE(config$lowercase)) {
    res <- convert_lowercase(res)
  }

  # 3. Expand contractions (always run when stopwords OR punctuation is enabled)
  #    This prevents orphaned fragments like "don t" from don't
  if (isTRUE(config$stopwords) || isTRUE(config$punctuation)) {
    res <- expand_contractions(res)
  }

  # 4. Remove stopwords (must happen before punctuation removal,
  #    while words are still intact with proper boundaries)
  if (isTRUE(config$stopwords)) {
    res <- remove_stopwords(res)
  }

  # 5. Remove punctuation (safe now — contractions and stopwords already handled)
  if (isTRUE(config$punctuation)) {
    res <- remove_punctuation(res)
  }

  # 6. Remove special characters
  if (isTRUE(config$specialChars)) {
    res <- remove_special_chars(res)
  }

  # 7. Remove numbers
  if (isTRUE(config$numbers)) {
    res <- remove_numbers(res)
  }
  
  return(str_trim(res))
}

#' Orchestrator: Apply preprocessing to dataset
#' @param df Dataframe
#' @param columns Target columns
#' @param missing_strategy "deletion" or "skip"
#' @param config List of boolean toggles
#' @return List with $processed_df and $stats
apply_preprocessing <- function(df, columns, missing_strategy, config) {
  
  # 1. Handle missing text
  df_clean <- handle_missing_text(df, columns, missing_strategy)
  
  # 2. Capture raw text AFTER missing handling but BEFORE transformation
  #    This ensures preview rows are correctly aligned even when rows were deleted
  raw_texts_by_col <- list()
  for (col in columns) {
    raw_texts_by_col[[col]] <- df_clean[[col]]
  }

  # Keep track of raw texts for stats
  all_raw_samples <- c()
  all_transformed_samples <- c()
  
  # 3. Apply text normalization to target columns
  for (col in columns) {
    raw_texts <- df_clean[[col]]
    transformed_texts <- transform_text(raw_texts, config)
    df_clean[[col]] <- transformed_texts
    
    all_raw_samples <- c(all_raw_samples, raw_texts)
    all_transformed_samples <- c(all_transformed_samples, transformed_texts)
  }
  
  # 4. Compute stats
  stats <- compute_preprocessing_stats(
    all_raw_samples, 
    all_transformed_samples, 
    nrow(df_clean),
    config
  )
  
  # 5. Generate preview for frontend (first 20 rows per target column)
  #    Uses raw_texts_by_col (captured after missing handling, before transforms)
  #    so rows are correctly aligned with transformed output
  preview <- list()
  for (col in columns) {
    preview[[col]] <- data.frame(
      raw = head(raw_texts_by_col[[col]], 20),
      transformed = head(df_clean[[col]], 20)
    )
  }
  
  return(list(
    processed_df = df_clean,
    stats = stats,
    preview = preview
  ))
}

#' Compute preprocessing statistics matching frontend logic
compute_preprocessing_stats <- function(raw_texts, transformed_texts, total_rows, config) {
  active_toggles <- sum(unlist(config))
  
  # Cleaned records: strictly the exact number of rows remaining after missing value handling
  cleaned_records <- total_rows
  
  # Vocabulary size: unique words in transformed text
  # Filter out empty strings
  all_words <- unlist(str_split(transformed_texts[transformed_texts != ""], "\\s+"))
  all_words <- all_words[all_words != ""]
  vocab_size <- length(unique(all_words))
  
  # Noise reduction: character-level difference ignoring whitespace
  # We strip whitespace because replacing punctuation/HTML with spaces (to prevent word smashing)
  # artificially masks the reduction if we count spaces.
  raw_no_space <- gsub("\\s+", "", raw_texts)
  trans_no_space <- gsub("\\s+", "", transformed_texts)
  
  raw_total <- sum(nchar(raw_no_space), na.rm = TRUE)
  transformed_total <- sum(nchar(trans_no_space), na.rm = TRUE)
  
  noise_reduction <- 0
  if (raw_total > 0) {
    noise_reduction <- round((1 - (transformed_total / raw_total)) * 100, 1)
  }
  
  # Ensure it doesn't drop below 0
  if (noise_reduction < 0) {
    noise_reduction <- 0
  }
  
  return(list(
    cleaned_records = cleaned_records,
    vocab_size = vocab_size,
    noise_reduction = noise_reduction
  ))
}
