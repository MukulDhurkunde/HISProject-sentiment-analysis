# analysis_ml_training.R: Trains and evaluates ML models (80/20 split).

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

stratified_split <- function(labels, train_ratio = 0.8, seed = 42) {
  set.seed(seed)
  train_idx <- c()
  for (lev in levels(labels)) {
    idx       <- which(labels == lev)
    n_train   <- max(1, floor(length(idx) * train_ratio))
    sampled   <- if (length(idx) == 1) idx else sample(idx, n_train)
    train_idx <- c(train_idx, sampled)
  }
  sort(train_idx)
}

train_and_evaluate <- function(texts, labels, ml_model, seed = 42) {

  labels <- as.factor(labels)

  # Exclude empty/NA labels from split; model still predicts all rows
  valid_mask   <- !is.na(labels) & nchar(trimws(as.character(labels))) > 0
  valid_labels <- droplevels(labels[valid_mask])

  if (nlevels(valid_labels) < 2) return(list(error = "Cannot train: only one class label found."))
  if (sum(valid_mask)        < 10) return(list(error = "Cannot train: fewer than 10 rows with valid labels."))

  suppressWarnings(suppressMessages({
    install_if_missing_ml("tm")
    install_if_missing_ml("NLP")
    install_if_missing_ml("slam")
    install_if_missing_ml("LiblineaR")
    install_if_missing_ml("glmnet")
    install_if_missing_ml("ranger")
    library(tm)
    library(LiblineaR)
    library(glmnet)
    library(ranger)
  }))

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

  # Matrix for SVM/glmnet, data.frame for ranger
  dtm_mat           <- as.matrix(dtm)
  colnames(dtm_mat) <- make.names(colnames(dtm_mat), unique = TRUE)
  dtm_df            <- as.data.frame(dtm_mat)

  all_valid_idx <- which(valid_mask)
  local_train   <- stratified_split(valid_labels, train_ratio = 0.8, seed = seed)
  train_idx     <- all_valid_idx[local_train]
  test_idx      <- all_valid_idx[-local_train]

  train_mat <- dtm_mat[train_idx, , drop = FALSE]
  test_mat  <- dtm_mat[test_idx,  , drop = FALSE]
  train_df  <- dtm_df[train_idx,  , drop = FALSE]
  test_df   <- dtm_df[test_idx,   , drop = FALSE]
  train_y   <- valid_labels[local_train]
  test_y    <- valid_labels[-local_train]

  if (length(test_y) < 2) return(list(error = "Test set has fewer than 2 samples. Upload more data."))

  cat(sprintf("DTM: %d docs x %d features · Training on %d valid-label rows\n",
              nrow(dtm_mat), ncol(dtm_mat), sum(valid_mask)))

  cat(sprintf("Training %s...\n", ml_model))

  train_result <- tryCatch({

    if (ml_model == "svm") {
      m          <- LiblineaR(data = train_mat, target = train_y, type = 1, cost = 1, verbose = FALSE)
      test_preds <- predict(m, newx = test_mat)$predictions
      full_preds <- predict(m, newx = dtm_mat)$predictions
      list(test_predictions = test_preds, all_predictions = full_preds)

    } else if (ml_model == "penalized_logistic") {
      glm_family <- if (nlevels(train_y) == 2) "binomial" else "multinomial"
      set.seed(seed)
      cv         <- cv.glmnet(x = train_mat, y = train_y, family = glm_family,
                              alpha = 1, nfolds = 5, type.measure = "class")
      test_raw   <- predict(cv, newx = test_mat,  s = "lambda.min", type = "class")
      full_raw   <- predict(cv, newx = dtm_mat,   s = "lambda.min", type = "class")
      test_preds <- factor(as.vector(test_raw), levels = levels(train_y))
      full_preds <- factor(as.vector(full_raw), levels = levels(train_y))
      list(test_predictions = test_preds, all_predictions = full_preds)

    } else if (ml_model == "random_forest") {
      m          <- ranger(x = train_df, y = train_y, num.trees = 300,
                           seed = seed, num.threads = NULL, verbose = FALSE)
      test_preds <- predict(m, data = test_df)$predictions
      full_preds <- predict(m, data = dtm_df)$predictions
      list(test_predictions = test_preds, all_predictions = full_preds)

    } else {
      stop(sprintf("Unknown model: '%s'", ml_model))
    }

  }, error = function(e) list(error = e$message))

  if (!is.null(train_result$error)) {
    return(list(error = sprintf("Training failed: %s", train_result$error)))
  }

  test_predictions <- factor(train_result$test_predictions, levels = levels(test_y))
  metrics          <- compute_metrics(test_predictions, test_y)

  cat(sprintf(
    "Results — Accuracy: %s%%  F1: %s%%  Precision: %s%%  Recall: %s%%\n",
    metrics$accuracy, metrics$f1_score, metrics$precision, metrics$recall
  ))

  list(
    accuracy        = metrics$accuracy,
    f1_score        = metrics$f1_score,
    precision       = metrics$precision,
    recall          = metrics$recall,
    model_name      = ml_model,
    train_size      = length(train_idx),
    test_size       = length(test_idx),
    all_predictions = as.character(train_result$all_predictions)
  )
}
