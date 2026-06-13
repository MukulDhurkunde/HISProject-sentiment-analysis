# ==============================================================================
# run_ml_training.R
# Standalone ML training module for sentiment classification.
# Called from run_analysis.R when a label column is provided.
# ==============================================================================

# --- Package installer (self-contained so this file can be sourced anywhere) ---
install_if_missing_ml <- function(pkg) {
  if (!requireNamespace(pkg, quietly = TRUE)) {
    cat(sprintf("Installing ML package '%s'...\n", pkg))
    dir.create(Sys.getenv("R_LIBS_USER"), recursive = TRUE, showWarnings = FALSE)
    suppressMessages(install.packages(
      pkg,
      lib = Sys.getenv("R_LIBS_USER"),
      repos = "http://cran.rstudio.com/",
      quiet = TRUE
    ))
  }
}

# --- Manual metrics computation (avoids heavy 'caret' dependency) -------------
compute_metrics <- function(predictions, actuals) {
  lvls <- levels(actuals)
  cm <- table(
    Predicted = factor(predictions, levels = lvls),
    Actual    = factor(actuals,     levels = lvls)
  )

  n <- sum(cm)
  accuracy <- if (n > 0) sum(diag(cm)) / n else 0

  n_classes <- length(lvls)
  precisions <- numeric(n_classes)
  recalls    <- numeric(n_classes)
  f1s        <- numeric(n_classes)
  supports   <- numeric(n_classes)

  for (i in seq_along(lvls)) {
    tp <- cm[i, i]
    fp <- sum(cm[i, ]) - tp
    fn <- sum(cm[, i]) - tp

    prec <- if ((tp + fp) > 0) tp / (tp + fp) else 0
    rec  <- if ((tp + fn) > 0) tp / (tp + fn) else 0
    f1   <- if ((prec + rec) > 0) 2 * prec * rec / (prec + rec) else 0

    precisions[i] <- prec
    recalls[i]    <- rec
    f1s[i]        <- f1
    supports[i]   <- sum(cm[, i])  # actual count per class
  }

  # Weighted average by class support
  total_support <- sum(supports)
  if (total_support == 0) total_support <- 1

  list(
    accuracy  = round(accuracy * 100, 1),
    precision = round(sum(precisions * supports) / total_support * 100, 1),
    recall    = round(sum(recalls    * supports) / total_support * 100, 1),
    f1_score  = round(sum(f1s        * supports) / total_support * 100, 1)
  )
}

# --- Stratified 80/20 split ---------------------------------------------------
stratified_split <- function(labels, train_ratio = 0.8, seed = 42) {
  set.seed(seed)
  train_idx <- c()
  for (lev in levels(labels)) {
    idx     <- which(labels == lev)
    n_train <- max(1, floor(length(idx) * train_ratio))
    train_idx <- c(train_idx, sample(idx, n_train))
  }
  sort(train_idx)
}

# ==============================================================================
# Main entry point
# ==============================================================================
train_and_evaluate <- function(texts, labels, ml_model, seed = 42) {

  # --- Validate inputs --------------------------------------------------------
  labels <- as.factor(labels)

  if (nlevels(labels) < 2) {
    return(list(
      error = "Cannot train: dataset contains only one class label."
    ))
  }
  if (length(texts) < 10) {
    return(list(
      error = "Cannot train: dataset has fewer than 10 rows."
    ))
  }

  # --- Install and load required packages -------------------------------------
  suppressWarnings(suppressMessages({
    install_if_missing_ml("tm")
    install_if_missing_ml("NLP")      # tm dependency, ensure present
    install_if_missing_ml("slam")     # sparse matrix ops
    install_if_missing_ml("e1071")    # Naive Bayes + SVM
    if (ml_model == "random_forest") {
      install_if_missing_ml("randomForest")
    }
    library(tm)
    library(e1071)
  }))

  # --- Build Document-Term Matrix (TF-IDF) ------------------------------------
  cat("Building Document-Term Matrix...\n")
  corpus <- VCorpus(VectorSource(texts))
  dtm <- DocumentTermMatrix(corpus, control = list(
    weighting    = weightTfIdf,
    bounds       = list(global = c(2, Inf))  # drop terms appearing in < 2 docs
  ))

  # Remove extremely sparse terms (keep those in >= 1% of documents)
  dtm <- removeSparseTerms(dtm, 0.99)

  # Cap at 1000 features for performance (O(n * 1000) instead of O(n * V))
  if (ncol(dtm) > 1000) {
    cs <- slam::col_sums(dtm)
    top_terms <- names(sort(cs, decreasing = TRUE))[1:1000]
    dtm <- dtm[, top_terms]
  }

  if (ncol(dtm) == 0) {
    return(list(
      error = "Cannot train: no features remain after text vectorisation."
    ))
  }

  cat(sprintf("DTM: %d docs x %d features\n", nrow(dtm), ncol(dtm)))

  # --- Convert to dense data frame --------------------------------------------
  dtm_df <- as.data.frame(as.matrix(dtm))
  colnames(dtm_df) <- make.names(colnames(dtm_df), unique = TRUE)

  # --- Stratified train/test split --------------------------------------------
  train_idx <- stratified_split(labels, train_ratio = 0.8, seed = seed)

  train_x <- dtm_df[train_idx, , drop = FALSE]
  test_x  <- dtm_df[-train_idx, , drop = FALSE]
  train_y <- labels[train_idx]
  test_y  <- labels[-train_idx]

  if (length(test_y) < 2) {
    return(list(
      error = "Cannot evaluate: test set has fewer than 2 samples. Upload more data."
    ))
  }

  # --- Train & Predict --------------------------------------------------------
  cat(sprintf("Training %s model...\n", ml_model))

  result <- tryCatch({
    predictions <- NULL

    if (ml_model == "naive_bayes") {
      model       <- naiveBayes(train_x, train_y)
      predictions <- predict(model, test_x)

    } else if (ml_model == "svm") {
      model       <- svm(
        x      = as.matrix(train_x),
        y      = train_y,
        kernel = "linear",
        cost   = 1,
        type   = "C-classification"
      )
      predictions <- predict(model, as.matrix(test_x))

    } else if (ml_model == "random_forest") {
      suppressWarnings(suppressMessages(library(randomForest)))
      train_x$..label.. <- train_y
      model       <- randomForest(..label.. ~ ., data = train_x, ntree = 100)
      predictions <- predict(model, test_x)

    } else {
      stop(sprintf("Unknown model: '%s'", ml_model))
    }

    list(ok = TRUE, predictions = predictions)
  }, error = function(e) {
    list(ok = FALSE, msg = e$message)
  })

  if (!result$ok) {
    return(list(
      error = sprintf("Training failed: %s", result$msg)
    ))
  }

  predictions <- result$predictions

  # --- Compute metrics --------------------------------------------------------
  predictions <- factor(predictions, levels = levels(test_y))
  metrics     <- compute_metrics(predictions, test_y)

  cat(sprintf(
    "Results — Accuracy: %s%%  F1: %s%%  Precision: %s%%  Recall: %s%%\n",
    metrics$accuracy, metrics$f1_score, metrics$precision, metrics$recall
  ))

  list(
    accuracy   = metrics$accuracy,
    f1_score   = metrics$f1_score,
    precision  = metrics$precision,
    recall     = metrics$recall,
    model_name = ml_model,
    train_size = length(train_idx),
    test_size  = length(test_y)
  )
}
