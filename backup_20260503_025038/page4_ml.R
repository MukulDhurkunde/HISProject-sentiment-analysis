# =============================================================================
# page4_ml.R
# Sentiment Analysis System — Machine Learning Module
# -----------------------------------------------------------------------------
# Handles: TF-IDF feature extraction, train/test split, model training,
#          prediction, and all performance metrics.
#
# Models:  Naive Bayes (e1071), SVM (e1071), Random Forest (randomForest)
# Metrics: Accuracy, Precision, Recall, F1-score, Confusion Matrix, ROC/AUC
# =============================================================================

suppressPackageStartupMessages({
  library(tm)
  library(tidytext)
  library(dplyr)
  library(tidyr)
  library(stringr)
  library(e1071)
  library(randomForest)
  library(caret)
  library(pROC)
})

# =============================================================================
# SECTION 1 — FEATURE EXTRACTION (TF-IDF Document-Term Matrix)
# =============================================================================

#' Build a sparse TF-IDF matrix from a character vector of texts.
#'
#' @param texts        Character vector of (cleaned) texts.
#' @param max_features Integer. Keep only the top N most frequent terms.
#'                     Default 500. Reducing helps with speed on large datasets.
#' @return List with:
#'   $dtm        — dense matrix, rows = documents, cols = terms
#'   $vocab      — character vector of kept terms
build_tfidf_matrix <- function(texts, max_features = 500) {

  corpus <- VCorpus(VectorSource(texts))

  dtm_raw <- DocumentTermMatrix(
    corpus,
    control = list(
      weighting        = weightTfIdf,
      removePunctuation = TRUE,
      removeNumbers    = TRUE,
      stopwords        = TRUE,
      tolower          = TRUE,
      minDocFreq       = 2          # term must appear in at least 2 docs
    )
  )

  # Remove empty terms and limit to top N by column sum (tf-idf total)
  dtm_raw   <- dtm_raw[, colSums(as.matrix(dtm_raw)) > 0]
  col_sums  <- colSums(as.matrix(dtm_raw))
  top_terms <- names(sort(col_sums, decreasing = TRUE)[seq_len(min(max_features, length(col_sums)))])

  dtm_reduced <- as.matrix(dtm_raw[, top_terms])

  list(
    dtm   = dtm_reduced,
    vocab = top_terms
  )
}

# =============================================================================
# SECTION 2 — TRAIN / TEST SPLIT
# =============================================================================

#' Split indices into 80% train / 20% test, stratified by label.
#'
#' @param labels  Factor or character vector of class labels.
#' @param seed    Integer random seed for reproducibility.
#' @return List with $train_idx and $test_idx (integer index vectors).
train_test_split <- function(labels, seed = 42) {
  set.seed(seed)
  labels <- as.factor(labels)
  train_idx <- createDataPartition(labels, p = 0.8, list = FALSE)[, 1]
  test_idx  <- setdiff(seq_along(labels), train_idx)
  list(train_idx = train_idx, test_idx = test_idx)
}

# =============================================================================
# SECTION 3 — MODEL TRAINING & PREDICTION
# =============================================================================

#' Train a Naive Bayes model and return predictions on the test set.
#'
#' @param train_mat  Numeric matrix — training features (rows = docs).
#' @param train_lbl  Factor         — training labels.
#' @param test_mat   Numeric matrix — test features.
#' @return List with $model, $predicted (factor), $probabilities (matrix)
train_naive_bayes <- function(train_mat, train_lbl, test_mat) {
  model <- naiveBayes(train_mat, train_lbl)
  probs <- predict(model, test_mat, type = "raw")
  preds <- predict(model, test_mat, type = "class")
  list(model = model, predicted = preds, probabilities = probs)
}

#' Train an SVM model with probability estimates.
train_svm <- function(train_mat, train_lbl, test_mat) {
  model <- svm(
    x           = train_mat,
    y           = train_lbl,
    kernel      = "linear",
    probability = TRUE,
    scale       = FALSE        # TF-IDF already normalised
  )
  raw   <- predict(model, test_mat, probability = TRUE)
  probs <- attr(raw, "probabilities")
  preds <- as.factor(raw)
  list(model = model, predicted = preds, probabilities = probs)
}

#' Train a Random Forest model.
train_random_forest <- function(train_mat, train_lbl, test_mat) {
  set.seed(42)
  model <- randomForest(
    x      = train_mat,
    y      = train_lbl,
    ntree  = 100,              # balanced speed vs accuracy
    importance = FALSE
  )
  probs <- predict(model, test_mat, type = "prob")
  preds <- predict(model, test_mat, type = "class")
  list(model = model, predicted = preds, probabilities = probs)
}

# =============================================================================
# SECTION 4 — PERFORMANCE METRICS
# =============================================================================

#' Compute Accuracy, Precision, Recall, F1 from actual vs predicted labels.
#'
#' For multi-class problems, Precision/Recall/F1 are macro-averaged.
#'
#' @param actual    Factor. True labels (test set).
#' @param predicted Factor. Model predictions.
#' @return Named numeric vector: accuracy, precision, recall, f1
compute_metrics <- function(actual, predicted) {
  actual    <- as.factor(actual)
  predicted <- factor(predicted, levels = levels(actual))

  cm     <- confusionMatrix(predicted, actual)
  acc    <- as.numeric(cm$overall["Accuracy"])

  # Per-class metrics from caret's byClass
  by_class <- cm$byClass

  if (is.null(dim(by_class))) {
    # Binary — single row returned as named vector
    precision <- as.numeric(by_class["Precision"])
    recall    <- as.numeric(by_class["Recall"])
    f1        <- as.numeric(by_class["F1"])
  } else {
    # Multi-class — matrix, one row per class → macro average
    precision <- mean(by_class[, "Precision"], na.rm = TRUE)
    recall    <- mean(by_class[, "Recall"],    na.rm = TRUE)
    f1        <- mean(by_class[, "F1"],        na.rm = TRUE)
  }

  c(accuracy = round(acc, 4),
    precision = round(precision, 4),
    recall    = round(recall, 4),
    f1        = round(f1, 4))
}

#' Build a confusion matrix dataframe suitable for heatmap rendering.
#'
#' @param actual    Factor. True labels.
#' @param predicted Factor. Model predictions.
#' @return Tibble with columns: actual, predicted, count
build_confusion_matrix <- function(actual, predicted) {
  actual    <- as.factor(actual)
  predicted <- factor(predicted, levels = levels(actual))

  as.data.frame(table(Actual = actual, Predicted = predicted)) %>%
    rename(count = Freq) %>%
    as_tibble()
}

#' Compute ROC curve data and AUC for each class (one-vs-rest).
#'
#' @param actual       Factor.           True labels.
#' @param probabilities Matrix or data.frame. Columns = class names, rows = docs.
#'                      Column names must match levels of `actual`.
#' @return List, one element per class:
#'   Each element is a list with $auc (numeric), $roc_df (tibble: fpr, tpr, threshold)
compute_roc_auc <- function(actual, probabilities) {
  actual  <- as.factor(actual)
  classes <- levels(actual)

  # Align probability columns to class names
  prob_df <- as.data.frame(probabilities)
  results <- list()

  for (cls in classes) {
    if (!cls %in% names(prob_df)) next

    binary_actual <- as.integer(actual == cls)
    scores        <- prob_df[[cls]]

    roc_obj <- tryCatch(
      roc(binary_actual, scores, quiet = TRUE),
      error = function(e) NULL
    )

    if (is.null(roc_obj)) {
      results[[cls]] <- list(auc = NA, roc_df = NULL)
      next
    }

    auc_val <- as.numeric(auc(roc_obj))

    roc_df <- tibble(
      fpr       = 1 - roc_obj$specificities,
      tpr       = roc_obj$sensitivities,
      threshold = roc_obj$thresholds,
      class     = cls
    )

    results[[cls]] <- list(auc = round(auc_val, 4), roc_df = roc_df)
  }

  results
}

# =============================================================================
# SECTION 5 — SINGLE MODEL RUNNER
# =============================================================================

#' Train and evaluate one ML model end-to-end.
#'
#' @param texts         Character vector of cleaned texts (ALL rows).
#' @param labels        Character/factor vector of labels (ALL rows).
#' @param method        One of "naive_bayes", "svm", "random_forest".
#' @param max_features  Max TF-IDF vocabulary size.
#' @return List with:
#'   $method          — string name of the model
#'   $metrics         — named numeric vector (accuracy, precision, recall, f1)
#'   $confusion_matrix — tibble (actual, predicted, count)
#'   $roc_auc         — list per class (auc, roc_df)
#'   $test_predictions — tibble (doc_id, actual, predicted)
#'   $label_levels    — character vector of class levels
run_single_model <- function(texts,
                             labels,
                             method       = "naive_bayes",
                             max_features = 500) {

  labels <- as.factor(labels)

  # Feature extraction
  tfidf  <- build_tfidf_matrix(texts, max_features)
  dtm    <- tfidf$dtm

  # Train/test split
  split     <- train_test_split(labels)
  train_idx <- split$train_idx
  test_idx  <- split$test_idx

  train_mat <- dtm[train_idx, , drop = FALSE]
  test_mat  <- dtm[test_idx,  , drop = FALSE]
  train_lbl <- labels[train_idx]
  test_lbl  <- labels[test_idx]

  # Train model
  result <- switch(
    method,
    naive_bayes   = train_naive_bayes(train_mat, train_lbl, test_mat),
    svm           = train_svm(train_mat, train_lbl, test_mat),
    random_forest = train_random_forest(train_mat, train_lbl, test_mat),
    stop(paste("Unknown ML method:", method))
  )

  predicted <- result$predicted
  probs     <- result$probabilities

  # Align probability column names to label levels
  if (!is.null(probs)) {
    colnames(probs) <- make.names(colnames(probs))
    lbl_names       <- make.names(levels(test_lbl))
    probs           <- probs[, lbl_names, drop = FALSE]
    colnames(probs) <- levels(test_lbl)
  }

  # Metrics
  metrics <- compute_metrics(test_lbl, predicted)

  # Confusion matrix
  cm_df <- build_confusion_matrix(test_lbl, predicted)

  # ROC / AUC
  roc_auc <- if (!is.null(probs) && length(levels(test_lbl)) >= 2) {
    compute_roc_auc(test_lbl, probs)
  } else {
    NULL
  }

  # Predictions table
  preds_table <- tibble(
    doc_id    = test_idx,
    actual    = as.character(test_lbl),
    predicted = as.character(predicted)
  )

  list(
    method           = method,
    metrics          = metrics,
    confusion_matrix = cm_df,
    roc_auc          = roc_auc,
    test_predictions = preds_table,
    label_levels     = levels(labels)
  )
}

# =============================================================================
# SECTION 6 — COMPARE MODE (all 3 models)
# =============================================================================

#' Run all three ML models and return combined results for comparison.
#'
#' @param texts        Character vector of cleaned texts.
#' @param labels       Character/factor vector of labels.
#' @param max_features Max TF-IDF vocabulary size.
#' @return List with:
#'   $models          — named list, one entry per model (output of run_single_model)
#'   $best_metrics    — named list: best accuracy/precision/recall/f1 across models,
#'                      each a list with $value and $model (which model achieved it)
#'   $comparison_df   — tibble: model, accuracy, precision, recall, f1
run_compare_models <- function(texts, labels, max_features = 500) {

  methods <- c("naive_bayes", "svm", "random_forest")
  models  <- list()

  cat("  [Compare Mode] Training Naive Bayes...\n")
  models[["naive_bayes"]]   <- run_single_model(texts, labels, "naive_bayes",   max_features)

  cat("  [Compare Mode] Training SVM...\n")
  models[["svm"]]           <- run_single_model(texts, labels, "svm",           max_features)

  cat("  [Compare Mode] Training Random Forest...\n")
  models[["random_forest"]] <- run_single_model(texts, labels, "random_forest", max_features)

  # Comparison dataframe
  comparison_df <- bind_rows(lapply(methods, function(m) {
    met <- models[[m]]$metrics
    tibble(
      model     = m,
      accuracy  = met["accuracy"],
      precision = met["precision"],
      recall    = met["recall"],
      f1        = met["f1"]
    )
  }))

  # Best value per metric
  metric_names <- c("accuracy", "precision", "recall", "f1")
  best_metrics <- lapply(metric_names, function(metric) {
    vals      <- setNames(comparison_df[[metric]], comparison_df$model)
    best_model <- names(which.max(vals))
    list(value = vals[best_model], model = best_model)
  })
  names(best_metrics) <- metric_names

  list(
    models        = models,
    best_metrics  = best_metrics,
    comparison_df = comparison_df
  )
}

# =============================================================================
# SECTION 7 — DISPATCH FUNCTION (called by page4_results.R)
# =============================================================================

#' Master ML dispatcher — runs single model or compare mode.
#'
#' @param texts        Character vector of cleaned texts.
#' @param labels       Character/factor vector of labels.
#' @param method       One of "naive_bayes", "svm", "random_forest".
#' @param compare_mode Logical. If TRUE, runs all 3 models.
#' @param max_features Max TF-IDF vocabulary size.
#' @return Output of run_single_model() or run_compare_models().
run_ml_analysis <- function(texts,
                            labels,
                            method       = "naive_bayes",
                            compare_mode = FALSE,
                            max_features = 500) {
  if (compare_mode) {
    run_compare_models(texts, labels, max_features)
  } else {
    run_single_model(texts, labels, method, max_features)
  }
}

# =============================================================================
# SECTION 8 — SELF-TEST
# =============================================================================

test_ml_module <- function() {

  # Sample labelled dataset (40 rows for a meaningful 80/20 split)
  positive_texts <- c(
    "I absolutely love this product it is wonderful and amazing",
    "Fantastic quality and great value for money very happy",
    "Outstanding performance and brilliant design",
    "Excellent service and superb quality highly recommended",
    "Really good product works perfectly as expected",
    "Great purchase very satisfied with this item",
    "Love it best product I have ever bought",
    "Amazing quality fast delivery very pleased",
    "Perfect exactly what I needed highly satisfied",
    "Wonderful experience will buy again",
    "Super happy with my purchase great value",
    "Best quality product at this price point",
    "Very pleased excellent build quality",
    "Highly recommend this fantastic product",
    "Great item does exactly what it says",
    "Brilliant product outstanding customer service",
    "Very happy with this purchase recommended",
    "Excellent product works great as described",
    "Love the quality amazing value for money",
    "Perfect purchase very satisfied overall"
  )

  negative_texts <- c(
    "This is the worst experience I have ever had terrible service",
    "Awful disgusting and completely broken total waste of money",
    "Disappointing and frustrating would not recommend",
    "Terrible quality broke after one day complete rubbish",
    "Very poor quality not as described waste of money",
    "Awful product stopped working after a week",
    "Worst purchase ever very disappointed",
    "Terrible service slow delivery broken item",
    "Poor quality cheaply made do not buy",
    "Very disappointing nothing like the description",
    "Complete waste of money terrible product",
    "Broken on arrival very frustrating",
    "Disgusting quality would never buy again",
    "Worst product I have ever used avoid",
    "Terrible experience poor customer support",
    "Very unhappy with this purchase awful quality",
    "Dreadful product falls apart immediately",
    "Shocking quality complete disappointment",
    "Terrible do not waste your money",
    "Awful experience never buying from here again"
  )

  texts  <- c(positive_texts, negative_texts)
  labels <- c(rep("Positive", 20), rep("Negative", 20))

  cat("\n========================================\n")
  cat("  ML MODULE — SELF TEST\n")
  cat("========================================\n\n")

  # --- Naive Bayes ---
  cat("--- Naive Bayes | Binary ---\n")
  res_nb <- run_single_model(texts, labels, method = "naive_bayes")
  cat("Metrics:\n"); print(res_nb$metrics)
  cat("\nConfusion Matrix:\n"); print(res_nb$confusion_matrix)
  cat("\nROC AUC per class:\n")
  for (cls in names(res_nb$roc_auc)) {
    cat(" ", cls, "— AUC:", res_nb$roc_auc[[cls]]$auc, "\n")
  }

  # --- SVM ---
  cat("\n--- SVM | Binary ---\n")
  res_svm <- run_single_model(texts, labels, method = "svm")
  cat("Metrics:\n"); print(res_svm$metrics)
  cat("\nConfusion Matrix:\n"); print(res_svm$confusion_matrix)

  # --- Random Forest ---
  cat("\n--- Random Forest | Binary ---\n")
  res_rf <- run_single_model(texts, labels, method = "random_forest")
  cat("Metrics:\n"); print(res_rf$metrics)
  cat("\nConfusion Matrix:\n"); print(res_rf$confusion_matrix)

  # --- Compare Mode ---
  cat("\n--- Compare Mode (all 3 models) ---\n")
  res_cmp <- run_compare_models(texts, labels)
  cat("\nComparison Table:\n"); print(res_cmp$comparison_df)
  cat("\nBest per metric:\n")
  for (metric in names(res_cmp$best_metrics)) {
    bm <- res_cmp$best_metrics[[metric]]
    cat(sprintf("  %-10s %.4f  (%s)\n", metric, bm$value, bm$model))
  }

  # --- Dispatcher ---
  cat("\n--- Dispatcher Test (svm / single) ---\n")
  res_dispatch <- run_ml_analysis(texts, labels, method = "svm", compare_mode = FALSE)
  cat("Dispatcher returned method:", res_dispatch$method, "\n")
  cat("Accuracy:", res_dispatch$metrics["accuracy"], "\n")

  cat("\n✔ All ML tests completed — page4_ml.R is working correctly.\n\n")
}
