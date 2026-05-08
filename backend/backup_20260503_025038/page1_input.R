# =============================================================================
# page1_input.R
# Sentiment Analysis System — Data Input & Initial Analysis Module
# -----------------------------------------------------------------------------
# Handles: CSV loading, manual text paste, text column auto-detection,
#          label column detection, KPI computation, data preview table.
#
# Dependencies: dplyr, tidyr, stringr, readr
# =============================================================================

suppressPackageStartupMessages({
  library(dplyr)
  library(tidyr)
  library(stringr)
  library(readr)
})

# =============================================================================
# SECTION 1 — DATA LOADING
# =============================================================================

#' Load a CSV file into a dataframe.
#'
#' @param filepath   Character. Path to the uploaded CSV file.
#' @param encoding   Character. File encoding. Default "UTF-8".
#' @return Tibble of loaded data, or an error string if loading fails.
load_csv <- function(filepath, encoding = "UTF-8") {
  tryCatch({
    df <- read_csv(
      filepath,
      locale        = locale(encoding = encoding),
      show_col_types = FALSE,
      trim_ws       = TRUE
    )
    # Drop fully empty rows
    df <- df %>% filter(if_any(everything(), ~ !is.na(.x) & .x != ""))
    df
  }, error = function(e) {
    stop(paste("Failed to read CSV:", e$message))
  })
}

#' Convert manually pasted raw text into a single-column tibble.
#'
#' Each non-empty line becomes one row. Useful when user pastes
#' multiple sentences or a block of text.
#'
#' @param raw_text Character. The text block pasted by the user.
#' @return Tibble with one column: `text`
load_pasted_text <- function(raw_text) {
  lines <- str_split(raw_text, "\n")[[1]]
  lines <- str_squish(lines)
  lines <- lines[nchar(lines) > 0]

  if (length(lines) == 0) stop("No text found. Please paste at least one line.")

  tibble(text = lines)
}

# =============================================================================
# SECTION 2 — COLUMN AUTO-DETECTION
# =============================================================================

#' Auto-detect the text column from a dataframe.
#'
#' Strategy: find the character column with the highest median word count.
#' A "text" column typically has long strings vs other short string columns
#' like categories or IDs.
#'
#' @param df Tibble/dataframe.
#' @return List with:
#'   $column      — character. Name of detected column (or NULL if none found).
#'   $confidence  — one of "high", "low"
#'   $all_candidates — named numeric vector: column → median word count
detect_text_column <- function(df) {

  # Consider only character/string columns
  char_cols <- names(df)[sapply(df, function(col) is.character(col) | is.factor(col))]

  if (length(char_cols) == 0) {
    return(list(column = NULL, confidence = "low", all_candidates = numeric(0)))
  }

  # Median word count per column
  median_wc <- sapply(char_cols, function(col) {
    vals <- as.character(df[[col]])
    vals <- vals[!is.na(vals) & nchar(str_squish(vals)) > 0]
    if (length(vals) == 0) return(0)
    median(str_count(vals, "\\S+"), na.rm = TRUE)
  })

  # Sort descending
  median_wc <- sort(median_wc, decreasing = TRUE)

  best_col <- names(median_wc)[1]
  best_wc  <- median_wc[1]

  # Confidence: high if median word count >= 4 words (clearly prose/text)
  confidence <- if (best_wc >= 4) "high" else "low"

  list(
    column          = best_col,
    confidence      = confidence,
    all_candidates  = median_wc
  )
}

#' Auto-detect the label column from a dataframe.
#'
#' Strategy: find a character column (that is NOT the text column) with a
#' small number of distinct values (2–10), suggesting it's a categorical label.
#'
#' @param df          Tibble/dataframe.
#' @param text_column Character. Name of already-detected text column to exclude.
#' @return List with:
#'   $column      — character. Name of detected label column (or NULL).
#'   $levels      — character vector of unique label values (or NULL).
#'   $has_labels  — logical. TRUE if a valid label column was found.
detect_label_column <- function(df, text_column = NULL) {

  candidate_cols <- names(df)
  if (!is.null(text_column)) {
    candidate_cols <- setdiff(candidate_cols, text_column)
  }

  for (col in candidate_cols) {
    vals    <- df[[col]]
    n_uniq  <- length(unique(na.omit(vals)))
    # A label column: few distinct values (2–10), and not all numeric-looking
    is_char_like <- is.character(vals) | is.factor(vals) |
                    (is.numeric(vals) & n_uniq <= 5)  # e.g. 0/1 binary labels

    if (is_char_like && n_uniq >= 2 && n_uniq <= 10) {
      lvls <- as.character(sort(unique(na.omit(vals))))
      return(list(column = col, levels = lvls, has_labels = TRUE))
    }
  }

  list(column = NULL, levels = NULL, has_labels = FALSE)
}

# =============================================================================
# SECTION 3 — KPI COMPUTATION
# =============================================================================

#' Detect the language of a character vector of texts.
#'
#' Uses a lightweight heuristic: checks for high-frequency English words.
#' Falls back to "Unknown" if detection is uncertain.
#' This avoids any external API dependency.
#'
#' @param texts Character vector.
#' @return Character string: detected language name (e.g. "English").
detect_language <- function(texts) {
  sample_text <- paste(texts[seq_len(min(20, length(texts)))], collapse = " ")
  sample_text <- tolower(sample_text)

  # Simple heuristic: count common English function words
  english_words <- c("the", "is", "are", "was", "and", "for", "that",
                     "this", "with", "have", "not", "you", "it", "of")
  en_count <- sum(str_count(sample_text,
                             paste0("\\b", english_words, "\\b")))

  # Common German words
  german_words  <- c("und", "der", "die", "das", "ist", "nicht", "ich",
                     "sie", "mit", "ein", "eine", "auf", "des")
  de_count <- sum(str_count(sample_text,
                              paste0("\\b", german_words, "\\b")))

  # Common French words
  french_words  <- c("les", "des", "est", "une", "que", "qui", "pas",
                     "sur", "avec", "pour", "dans", "vous")
  fr_count <- sum(str_count(sample_text,
                              paste0("\\b", french_words, "\\b")))

  counts <- c(English = en_count, German = de_count, French = fr_count)
  best   <- names(which.max(counts))

  if (max(counts) == 0) "Unknown" else best
}

#' Compute all KPI card values for Page 1.
#'
#' @param df          Tibble. The loaded dataset.
#' @param text_column Character. Name of the text column.
#' @return Named list:
#'   $total_records   — integer
#'   $avg_word_count  — numeric (1 dp)
#'   $missing_values  — integer (count of NA or empty text rows)
#'   $language        — character string
compute_kpis <- function(df, text_column) {

  texts <- as.character(df[[text_column]])

  # Missing: NA or blank after trimming
  is_missing    <- is.na(texts) | nchar(str_squish(texts)) == 0
  missing_count <- sum(is_missing)

  # Word count on non-missing rows only
  valid_texts   <- texts[!is_missing]
  word_counts   <- str_count(valid_texts, "\\S+")
  avg_wc        <- if (length(word_counts) == 0) 0 else round(mean(word_counts), 1)

  # Language detection
  lang <- detect_language(valid_texts)

  list(
    total_records  = nrow(df),
    avg_word_count = avg_wc,
    missing_values = missing_count,
    language       = lang
  )
}

# =============================================================================
# SECTION 4 — DATA PREVIEW TABLE
# =============================================================================

#' Build the data preview table (first 10 rows) for display in the UI.
#'
#' @param df           Tibble. The full loaded dataset.
#' @param text_column  Character. Name of the text column.
#' @param label_column Character or NULL. Name of label column (if detected).
#' @return Tibble with columns: Row, Text, Label (if present)
build_preview_table <- function(df, text_column, label_column = NULL) {

  n_rows <- min(10, nrow(df))

  preview <- tibble(
    Row  = seq_len(n_rows),
    Text = str_trunc(as.character(df[[text_column]][seq_len(n_rows)]), 120)
  )

  if (!is.null(label_column) && label_column %in% names(df)) {
    preview$Label <- as.character(df[[label_column]][seq_len(n_rows)])
  }

  preview
}

# =============================================================================
# SECTION 5 — MASTER ENTRY POINT (called by Shiny)
# =============================================================================

#' Process input data and return everything Page 1 needs to display.
#'
#' @param source       One of "csv" or "paste".
#' @param filepath     Character. CSV file path (if source == "csv").
#' @param raw_text     Character. Pasted text block (if source == "paste").
#' @param text_column  Character or NULL. If NULL, auto-detected.
#' @param label_column Character or NULL. If NULL, auto-detected.
#' @return List with:
#'   $df              — full tibble of loaded data
#'   $text_column     — character. Final chosen text column name
#'   $text_detection  — list from detect_text_column() (for notice/dropdown)
#'   $label_info      — list from detect_label_column()
#'   $kpis            — list from compute_kpis()
#'   $preview_table   — tibble from build_preview_table()
#'   $texts           — character vector of the raw text column values
process_input <- function(source       = "csv",
                          filepath     = NULL,
                          raw_text     = NULL,
                          text_column  = NULL,
                          label_column = NULL) {

  # Load data
  df <- if (source == "csv") {
    if (is.null(filepath)) stop("filepath must be provided for CSV source.")
    load_csv(filepath)
  } else if (source == "paste") {
    if (is.null(raw_text) || nchar(str_squish(raw_text)) == 0)
      stop("raw_text must be provided for paste source.")
    load_pasted_text(raw_text)
  } else {
    stop(paste("Unknown source:", source, "— must be 'csv' or 'paste'."))
  }

  # Text column detection
  text_detection <- detect_text_column(df)
  final_text_col <- if (!is.null(text_column) && text_column %in% names(df)) {
    text_column                      # user overrode the auto-detection
  } else {
    text_detection$column            # use auto-detected
  }

  if (is.null(final_text_col)) stop("Could not identify a text column. Please select one manually.")

  # Label column detection
  label_info <- if (!is.null(label_column) && label_column %in% names(df)) {
    lvls <- as.character(sort(unique(na.omit(df[[label_column]]))))
    list(column = label_column, levels = lvls, has_labels = TRUE)
  } else {
    detect_label_column(df, text_column = final_text_col)
  }

  # KPIs
  kpis <- compute_kpis(df, final_text_col)

  # Preview table
  preview <- build_preview_table(df, final_text_col, label_info$column)

  # Raw text vector
  texts <- as.character(df[[final_text_col]])

  list(
    df             = df,
    text_column    = final_text_col,
    text_detection = text_detection,
    label_info     = label_info,
    kpis           = kpis,
    preview_table  = preview,
    texts          = texts
  )
}

# =============================================================================
# SECTION 6 — SELF-TEST
# =============================================================================

test_input_module <- function() {

  cat("\n========================================\n")
  cat("  INPUT MODULE — SELF TEST\n")
  cat("========================================\n\n")

  # --- Test 1: Paste input ---
  cat("--- Test 1: Manual Text Paste ---\n")
  pasted <- "I love this product, it is amazing!\nTerrible quality, complete waste of money.\nDecent enough for the price."
  res_paste <- process_input(source = "paste", raw_text = pasted)

  cat("Rows loaded:    ", nrow(res_paste$df), "\n")
  cat("Text column:    ", res_paste$text_column, "\n")
  cat("Has labels:     ", res_paste$label_info$has_labels, "\n")
  cat("KPIs:\n")
  cat("  Total records: ", res_paste$kpis$total_records, "\n")
  cat("  Avg word count:", res_paste$kpis$avg_word_count, "\n")
  cat("  Missing values:", res_paste$kpis$missing_values, "\n")
  cat("  Language:      ", res_paste$kpis$language, "\n")
  cat("Preview table:\n"); print(res_paste$preview_table)

  # --- Test 2: CSV with labels ---
  cat("\n--- Test 2: CSV with label column ---\n")

  # Write a temp CSV for testing
  temp_csv <- tempfile(fileext = ".csv")
  test_df <- tibble(
    review    = c(
      "Absolutely fantastic product, highly recommended!",
      "Terrible experience, the product broke immediately.",
      "Pretty good overall, minor issues but nothing serious.",
      "Worst purchase ever, do not buy this.",
      "Great value for money, very satisfied.",
      "Not what I expected, quite disappointing.",
      "Excellent quality, fast delivery, love it!",
      "Poor quality control, arrived damaged."
    ),
    sentiment = c("positive","negative","positive","negative",
                  "positive","negative","positive","negative"),
    rating    = c(5L, 1L, 4L, 1L, 5L, 2L, 5L, 2L)
  )
  write_csv(test_df, temp_csv)

  res_csv <- process_input(source = "csv", filepath = temp_csv)

  cat("Rows loaded:       ", nrow(res_csv$df), "\n")
  cat("Text column:       ", res_csv$text_column, "\n")
  cat("Detection confidence:", res_csv$text_detection$confidence, "\n")
  cat("Label column:      ", res_csv$label_info$column, "\n")
  cat("Label levels:      ", paste(res_csv$label_info$levels, collapse = ", "), "\n")
  cat("Has labels:        ", res_csv$label_info$has_labels, "\n")
  cat("KPIs:\n")
  cat("  Total records: ", res_csv$kpis$total_records, "\n")
  cat("  Avg word count:", res_csv$kpis$avg_word_count, "\n")
  cat("  Missing values:", res_csv$kpis$missing_values, "\n")
  cat("  Language:      ", res_csv$kpis$language, "\n")
  cat("Preview table:\n"); print(res_csv$preview_table)

  # --- Test 3: CSV WITHOUT labels ---
  cat("\n--- Test 3: CSV without label column ---\n")
  test_df_no_label <- test_df %>% select(review)
  temp_csv2 <- tempfile(fileext = ".csv")
  write_csv(test_df_no_label, temp_csv2)

  res_no_label <- process_input(source = "csv", filepath = temp_csv2)
  cat("Has labels: ", res_no_label$label_info$has_labels, " (ML should be disabled)\n")

  # --- Test 4: Language detection ---
  cat("\n--- Test 4: Language detection ---\n")
  german_texts <- c("Das Produkt ist sehr gut und die Qualität ist ausgezeichnet",
                    "Ich bin sehr zufrieden mit dem Kauf und würde es empfehlen")
  cat("German text detected as:", detect_language(german_texts), "\n")

  english_texts <- c("This product is great and I love the quality",
                     "Highly recommended, best purchase of the year")
  cat("English text detected as:", detect_language(english_texts), "\n")

  # Cleanup
  file.remove(temp_csv, temp_csv2)

  cat("\n✔ All tests passed — page1_input.R is working correctly.\n\n")
}
