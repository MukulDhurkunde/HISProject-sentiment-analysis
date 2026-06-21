# ==============================================================================
# run_ml_training.R
# ML training module for sentiment classification.
# Models: Naive Bayes (e1071), Linear SVM (LiblineaR), Random Forest (ranger)
# ==============================================================================

CRAN_MIRROR <- "https://cloud.r-project.org"

install_if_missing_ml <- function(pkg) {
  if (!requireNamespace(pkg, quietly = TRUE)) {
    cat(sprintf("Installing '%s'...\n", pkg))
    dir.create(Sys.getenv("R_LIBS_USER"), recursive = TRUE, showWarnings = FALSE)
    suppressMessages(install.packages(
      pkg,
      lib   = Sys.getenv("R_LIBS_USER"),
      repos = CRAN_MIRROR,
      quiet = TRUE
    ))
  }
}

# --- Weighted metrics (precision / recall / F1 / accuracy) -------------------
compute_metrics <- function(predictions, actuals) {
  lvls <- levels(actuals)
  cm   <- table(
    Predicted = factor(predictions, levels = lvls),
    Actual    = factor(actuals,     levels = lvls)
  )
  n        <- sum(cm)
  accuracy <- if (n > 0) sum(diag(cm)) / n else 0

  n_classes  <- length(lvls)
  precisions <- numeric(n_classes)
  recalls    <- numeric(n_classes)
  f1s        <- numeric(n_classes)
  supports   <- numeric(n_classes)

  for (i in seq_along(lvls)) {
    tp <- cm[i, i]; fp <- sum(cm[i, ]) - tp; fn <- sum(cm[, i]) - tp
    prec <- if ((tp + fp) > 0) tp / (tp + fp) else 0
    rec  <- if ((tp + fn) > 0) tp / (tp + fn) else 0
    f1   <- if ((prec + rec) > 0) 2 * prec * rec / (prec + rec) else 0
    precisions[i] <- prec
    recalls[i]    <- rec
    f1s[i]        <- f1
    supports[i]   <- sum(cm[, i])
  }

  total <- max(sum(supports), 1)
  list(
    accuracy  = round(accuracy * 100, 1),
    precision = round(sum(precisions * supports) / total * 100, 1),
    recall    = round(sum(recalls    * supports) / total * 100, 1),
    f1_score  = round(sum(f1s        * supports) / total * 100, 1)
  )
}

# --- Stratified 80/20 split --------------------------------------------------
stratified_split <- function(labels, train_ratio = 0.8, seed = 42) {
  set.seed(seed)
  train_idx <- c()
  for (lev in levels(labels)) {
    idx       <- which(labels == lev)
    n_train   <- max(1, floor(length(idx) * train_ratio))
    train_idx <- c(train_idx, sample(idx, n_train))
  }
  sort(train_idx)
}

# ==============================================================================
# Main entry point
# ==============================================================================
train_and_evaluate <- function(texts, labels, ml_model, seed = 42) {

  labels <- as.factor(labels)

  if (nlevels(labels) < 2) return(list(error = "Cannot train: only one class label found."))
  if (length(texts)  < 10) return(list(error = "Cannot train: fewer than 10 rows."))

  # --- Install and load all packages upfront (unconditionally) ----------------
  suppressWarnings(suppressMessages({
    install_if_missing_ml("tm")
    install_if_missing_ml("NLP")
    install_if_missing_ml("slam")
    install_if_missing_ml("e1071")      # Naive Bayes
    install_if_missing_ml("ranger")     # Fast parallelized Random Forest
    install_if_missing_ml("LiblineaR")  # Fast linear SVM for high-dim text
    library(tm)
    library(e1071)
    library(ranger)
    library(LiblineaR)
  }))

  # --- Build TF-IDF Document-Term Matrix --------------------------------------
  cat("Building DTM...\n")
  corpus <- VCorpus(VectorSource(texts))
  dtm    <- DocumentTermMatrix(corpus, control = list(
    weighting = weightTfIdf,
    bounds    = list(global = c(2, Inf))
  ))
  dtm <- removeSparseTerms(dtm, 0.99)

  if (ncol(dtm) > 1000) {
    cs        <- slam::col_sums(dtm)
    top_terms <- names(sort(cs, decreasing = TRUE))[1:1000]
    dtm       <- dtm[, top_terms]
  }

  if (ncol(dtm) == 0) return(list(error = "No features remain after text vectorisation."))
  cat(sprintf("DTM: %d docs x %d features\n", nrow(dtm), ncol(dtm)))

  # Convert once to both forms — matrix for LiblineaR/SVM, data frame for NB/ranger
  dtm_mat           <- as.matrix(dtm)
  colnames(dtm_mat) <- make.names(colnames(dtm_mat), unique = TRUE)
  dtm_df            <- as.data.frame(dtm_mat)

  # --- Stratified train/test split --------------------------------------------
  train_idx <- stratified_split(labels, train_ratio = 0.8, seed = seed)

  train_mat <- dtm_mat[train_idx, , drop = FALSE]
  test_mat  <- dtm_mat[-train_idx, , drop = FALSE]
  train_df  <- dtm_df[train_idx,  , drop = FALSE]
  test_df   <- dtm_df[-train_idx, , drop = FALSE]
  train_y   <- labels[train_idx]
  test_y    <- labels[-train_idx]

  if (length(test_y) < 2) return(list(error = "Test set has fewer than 2 samples. Upload more data."))

  # --- Train & predict --------------------------------------------------------
  cat(sprintf("Training %s...\n", ml_model))

  result <- tryCatch({
    predictions <- NULL

    if (ml_model == "naive_bayes") {
      # e1071 Naive Bayes — fast probabilistic classifier
      model       <- naiveBayes(train_df, train_y)
      predictions <- predict(model, test_df)

    } else if (ml_model == "svm") {
      # LiblineaR linear SVM — optimized for high-dimensional sparse text (TF-IDF)
      # type=1: L2-regularized L2-loss SVM (dual) — standard for text classification
      model       <- LiblineaR(data = train_mat, target = train_y, type = 1, cost = 1, verbose = FALSE)
      predictions <- predict(model, newx = test_mat)$predictions

    } else if (ml_model == "random_forest") {
      # ranger — modern parallelized Random Forest, replaces randomForest package
      # Uses all available CPU cores, 5-10x faster than randomForest
      model       <- ranger(x = train_df, y = train_y, num.trees = 300,
                            seed = seed, num.threads = NULL, verbose = FALSE)
      predictions <- predict(model, data = test_df)$predictions

    } else {
      stop(sprintf("Unknown model: '%s'", ml_model))
    }

    list(ok = TRUE, predictions = predictions)
  }, error = function(e) list(ok = FALSE, msg = e$message))

  if (!result$ok) return(list(error = sprintf("Training failed: %s", result$msg)))

  predictions <- factor(result$predictions, levels = levels(test_y))
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
