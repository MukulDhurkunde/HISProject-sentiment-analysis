# analysis_page.R: Handles lexicon scoring and ML model training.



scores     <- numeric(length(texts))
labels     <- character(length(texts))
top_themes <- vector("list", length(texts))

if (lexicon == "nrc") {
  nrc_data   <- suppressWarnings(suppressMessages(get_nrc_sentiment(texts)))
  raw_scores <- nrc_data$positive - nrc_data$negative
  scores     <- raw_scores / word_counts
  emotions   <- c("anger", "anticipation", "disgust", "fear", "joy", "sadness", "surprise", "trust")

  for (i in seq_len(nrow(nrc_data))) {
    row_emotions <- unlist(nrc_data[i, emotions])
    sorted_emo   <- sort(row_emotions, decreasing = TRUE)
    non_zero     <- sorted_emo[sorted_emo > 0]

    if (length(non_zero) > 0) {
      top_n           <- head(names(non_zero), n = theme_count)
      top_themes[[i]] <- paste0(toupper(substr(top_n, 1, 1)), substring(top_n, 2))
    } else {
      top_themes[[i]] <- character(0)
    }

    if      (scores[i] > 0 && scores[i] >=  threshold) labels[i] <- "Positive"
    else if (scores[i] < 0 && scores[i] <= -threshold) labels[i] <- "Negative"
    else                                                labels[i] <- "Neutral"
  }
} else {
  raw_scores <- suppressWarnings(suppressMessages(get_sentiment(texts, method = lexicon)))
  scores     <- raw_scores / word_counts

  for (i in seq_along(scores)) {
    if      (scores[i] > 0 && scores[i] >=  threshold) labels[i] <- "Positive"
    else if (scores[i] < 0 && scores[i] <= -threshold) labels[i] <- "Negative"
    else                                                labels[i] <- "Neutral"
    top_themes[[i]] <- character(0)
  }
}


  df$sentiment_score <- raw_scores
df$sentiment_label <- labels

if (lexicon == "nrc") {
  df$emotional_themes <- vapply(top_themes, paste, collapse = ", ", FUN.VALUE = character(1))
  for (emo in emotions) df[[paste0("nrc_", emo)]] <- nrc_data[[emo]]
} else {
  df$emotional_themes <- ""
}

# Normalize original labels so frontend always has a clean "Label" field
if (!is.null(label_column) && nchar(label_column) > 0 && label_column %in% colnames(df)) {
  df$original_sentiment_label <- normalize_label_set(as.character(df[[label_column]]))
}



ml_metrics <- NULL
ml_error   <- NULL

if (!is.null(ml_model) && !is.null(label_column) &&
    nchar(ml_model) > 0 && nchar(label_column) > 0 &&
    label_column %in% colnames(df)) {

  cat(sprintf("\n--- ML Training: model=%s, label=%s ---\n", ml_model, label_column))
  source(file.path(script_dir, "analysis_ml_training.R"))

  # Normalize labels so model class names are clean
  ml_norm_labels <- normalize_label_set(as.character(df[[label_column]]))
  ml_result      <- train_and_evaluate(texts, ml_norm_labels, ml_model)

  if (!is.null(ml_result$error)) {
    ml_error <- ml_result$error
    cat(sprintf("ML Warning: %s\n", ml_error))
  } else {
    ml_metrics <- ml_result
    if (!is.null(ml_result$all_predictions) && length(ml_result$all_predictions) == nrow(df)) {
      df$ml_sentiment_label <- vapply(as.character(ml_result$all_predictions),
                                      normalize_sentiment, character(1))
    }
    cat("ML training complete.\n")
  }
}
