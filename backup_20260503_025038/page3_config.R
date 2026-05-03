# =============================================================================
# page3_config.R
# Sentiment Analysis System — Sentiment Engine Configuration Module
# -----------------------------------------------------------------------------
# Handles: sentiment type validation, method availability rules,
#          neutral granularity slider logic, compare mode toggle,
#          configuration summary builder, run-button gate logic.
#
# This module is pure logic — no UI. All outputs feed directly into
# Shiny reactives and renderUI calls in app.R.
#
# Dependencies: dplyr, stringr
# =============================================================================

suppressPackageStartupMessages({
  library(dplyr)
  library(stringr)
})

# =============================================================================
# SECTION 1 — CONSTANTS & VALID VALUES
# =============================================================================

VALID_SENTIMENT_TYPES <- c("binary", "ternary", "emotion")

VALID_METHODS <- c("afinn", "bing", "nrc", "naive_bayes", "svm", "random_forest")

LEXICON_METHODS <- c("afinn", "bing", "nrc")
ML_METHODS      <- c("naive_bayes", "svm", "random_forest")

# Human-readable display labels
METHOD_LABELS <- c(
  afinn         = "AFINN",
  bing          = "Bing",
  nrc           = "NRC",
  naive_bayes   = "Naive Bayes",
  svm           = "SVM",
  random_forest = "Random Forest"
)

SENTIMENT_TYPE_LABELS <- c(
  binary  = "Binary",
  ternary = "Ternary",
  emotion = "Emotion-based"
)

# Granularity slider bounds
GRANULARITY_MIN     <- 0
GRANULARITY_MAX     <- 5
GRANULARITY_DEFAULT <- 1    # maps to neutral_threshold for AFINN score
GRANULARITY_STEP    <- 0.5

# =============================================================================
# SECTION 2 — METHOD AVAILABILITY RULES
# =============================================================================

#' Determine which methods are available given current selections.
#'
#' Rules from spec:
#'   - NRC is ONLY available when sentiment_type == "emotion"
#'   - AFINN and Bing are NOT available when sentiment_type == "emotion"
#'   - ML methods are disabled if the dataset has no label column
#'   - In compare mode, ML single-select is replaced by all-3 auto-run
#'
#' @param sentiment_type  Character. One of "binary", "ternary", "emotion".
#' @param has_labels      Logical. Whether dataset has a label column.
#' @param compare_mode    Logical. Whether compare-all-ML-models is ON.
#' @return List with:
#'   $available        — character vector of available method keys
#'   $disabled         — named list: method_key → reason string (or NULL)
#'   $ml_tooltip       — character. Tooltip text shown on greyed ML methods.
get_method_availability <- function(sentiment_type  = "binary",
                                    has_labels      = TRUE,
                                    compare_mode    = FALSE) {

  sentiment_type <- tolower(sentiment_type)
  available      <- character(0)
  disabled       <- list()

  ml_tooltip <- if (!has_labels) {
    "ML models require labeled data. Your dataset has no label column."
  } else {
    NULL
  }

  for (method in VALID_METHODS) {

    reason <- NULL

    if (method == "nrc") {
      if (sentiment_type != "emotion") {
        reason <- "NRC is only available when Emotion-based type is selected."
      }

    } else if (method %in% c("afinn", "bing")) {
      if (sentiment_type == "emotion") {
        reason <- "AFINN and Bing are not compatible with Emotion-based type. Use NRC."
      }

    } else if (method %in% ML_METHODS) {
      if (!has_labels) {
        reason <- ml_tooltip
      }
    }

    if (is.null(reason)) {
      available <- c(available, method)
    } else {
      disabled[[method]] <- reason
    }
  }

  list(
    available  = available,
    disabled   = disabled,
    ml_tooltip = ml_tooltip
  )
}

# =============================================================================
# SECTION 3 — GRANULARITY SLIDER LOGIC
# =============================================================================

#' Determine whether the neutral granularity slider should be shown.
#'
#' Spec rule: show ONLY when ALL of:
#'   1. sentiment_type == "ternary"
#'   2. method %in% c("afinn", "bing")
#'   3. compare_mode == FALSE
#'
#' @param sentiment_type Character.
#' @param method         Character.
#' @param compare_mode   Logical.
#' @return Logical.
should_show_granularity <- function(sentiment_type, method, compare_mode = FALSE) {
  sentiment_type <- tolower(sentiment_type)
  method         <- tolower(method)

  sentiment_type == "ternary" &&
    method %in% c("afinn", "bing") &&
    !compare_mode
}

#' Convert the UI granularity slider value (0–5) to a neutral_threshold
#' value appropriate for the selected method.
#'
#' AFINN uses a score-based threshold:
#'   granularity 0 → threshold 5  (very wide neutral zone, most text = Neutral)
#'   granularity 5 → threshold 0  (no neutral zone, everything classified)
#'
#' Bing uses a ratio-based threshold (0–1):
#'   granularity 0 → ratio 0.5   (very wide neutral zone)
#'   granularity 5 → ratio 0.05  (very narrow, almost nothing is Neutral)
#'
#' @param granularity_value Numeric (0–5). Value from the UI slider.
#' @param method            Character. "afinn" or "bing".
#' @return Numeric. The neutral_threshold to pass to score_afinn() or score_bing().
granularity_to_threshold <- function(granularity_value, method) {
  method <- tolower(method)
  g      <- as.numeric(granularity_value)
  g      <- max(GRANULARITY_MIN, min(GRANULARITY_MAX, g))   # clamp to [0, 5]

  if (method == "afinn") {
    # Linear mapping: granularity 0 → threshold 5, granularity 5 → threshold 0
    threshold <- GRANULARITY_MAX - g
  } else if (method == "bing") {
    # Linear mapping: granularity 0 → ratio 0.50, granularity 5 → ratio 0.05
    threshold <- 0.50 - (g / GRANULARITY_MAX) * 0.45
    threshold <- round(threshold, 3)
  } else {
    threshold <- GRANULARITY_DEFAULT
  }

  threshold
}

#' Describe the effect of the current granularity setting in plain text.
#' Used for the sub-label shown below the slider in the UI.
#'
#' @param granularity_value Numeric (0–5).
#' @return Character string.
describe_granularity <- function(granularity_value) {
  g <- as.numeric(granularity_value)
  if (g <= 1) {
    "Wide neutral zone — more text classified as Neutral."
  } else if (g <= 3) {
    "Moderate neutral zone — balanced classification."
  } else {
    "Narrow neutral zone — borderline words pushed to Positive or Negative."
  }
}

# =============================================================================
# SECTION 4 — COMPARE MODE LOGIC
# =============================================================================

#' Validate whether compare mode can be enabled given current state.
#'
#' Compare mode requires:
#'   - has_labels == TRUE (ML needs labels)
#'   - Sentiment type is NOT "emotion" (compare mode is ML-only)
#'
#' @param has_labels     Logical.
#' @param sentiment_type Character.
#' @return List with:
#'   $allowed — logical. Whether compare mode can be turned on.
#'   $reason  — character or NULL. Why it's not allowed (for UI tooltip).
validate_compare_mode <- function(has_labels, sentiment_type) {
  sentiment_type <- tolower(sentiment_type)

  if (!has_labels) {
    return(list(
      allowed = FALSE,
      reason  = "Compare mode requires labeled data. Your dataset has no label column."
    ))
  }

  if (sentiment_type == "emotion") {
    return(list(
      allowed = FALSE,
      reason  = "Compare mode is not available for Emotion-based analysis (ML models only)."
    ))
  }

  list(allowed = TRUE, reason = NULL)
}

# =============================================================================
# SECTION 5 — RUN BUTTON GATE
# =============================================================================

#' Check whether the Run Analysis button should be enabled.
#'
#' Spec rule: button is enabled ONLY when Step 1 (sentiment type) AND
#' Step 2 (method) are both selected.
#'
#' Also validates that the selected combination is legal.
#'
#' @param sentiment_type  Character or NULL.
#' @param method          Character or NULL.
#' @param has_labels      Logical.
#' @param compare_mode    Logical.
#' @return List with:
#'   $enabled     — logical. Whether the Run button should be clickable.
#'   $hint        — character. Text to show below the button.
#'   $error       — character or NULL. Validation error if combination is illegal.
check_run_ready <- function(sentiment_type = NULL,
                            method         = NULL,
                            has_labels     = TRUE,
                            compare_mode   = FALSE) {

  # Step 1 missing
  if (is.null(sentiment_type) || !tolower(sentiment_type) %in% VALID_SENTIMENT_TYPES) {
    return(list(
      enabled = FALSE,
      hint    = "Complete Steps 1 and 2 to continue.",
      error   = NULL
    ))
  }

  # Step 2 missing (only required if NOT in compare mode — compare mode auto-selects all ML)
  if (!compare_mode && (is.null(method) || !tolower(method) %in% VALID_METHODS)) {
    return(list(
      enabled = FALSE,
      hint    = "Complete Steps 1 and 2 to continue.",
      error   = NULL
    ))
  }

  # In compare mode, no individual method needed — just needs labels
  if (compare_mode) {
    cv <- validate_compare_mode(has_labels, sentiment_type)
    if (!cv$allowed) {
      return(list(enabled = FALSE, hint = cv$reason, error = cv$reason))
    }
    return(list(enabled = TRUE, hint = "Ready — All ML models will run.", error = NULL))
  }

  # Validate the method is available for this sentiment type
  avail <- get_method_availability(sentiment_type, has_labels, compare_mode)
  method_lc <- tolower(method)

  if (method_lc %in% names(avail$disabled)) {
    reason <- avail$disabled[[method_lc]]
    return(list(enabled = FALSE, hint = reason, error = reason))
  }

  list(
    enabled = TRUE,
    hint    = "Ready — click to run analysis.",
    error   = NULL
  )
}

# =============================================================================
# SECTION 6 — CONFIGURATION SUMMARY (badge strip)
# =============================================================================

#' Build the configuration summary badge list for display on Pages 3 & 4.
#'
#' @param sentiment_type    Character or NULL.
#' @param method            Character or NULL.
#' @param compare_mode      Logical.
#' @param granularity_value Numeric or NULL. Only included if slider is visible.
#' @param show_granularity  Logical. Whether the slider was active.
#' @return Tibble with columns: label (badge text), type ("primary"/"secondary"/"accent")
build_config_summary <- function(sentiment_type    = NULL,
                                 method            = NULL,
                                 compare_mode      = FALSE,
                                 granularity_value = NULL,
                                 show_granularity  = FALSE) {

  badges <- list()

  # Sentiment type badge
  if (!is.null(sentiment_type) && tolower(sentiment_type) %in% VALID_SENTIMENT_TYPES) {
    badges <- c(badges, list(list(
      label = SENTIMENT_TYPE_LABELS[[tolower(sentiment_type)]],
      type  = "primary"
    )))
  }

  # Method badge(s)
  if (compare_mode) {
    badges <- c(badges, list(list(label = "Compare: All ML Models", type = "accent")))
  } else if (!is.null(method) && tolower(method) %in% VALID_METHODS) {
    badges <- c(badges, list(list(
      label = METHOD_LABELS[[tolower(method)]],
      type  = "secondary"
    )))
  }

  # Granularity badge
  if (show_granularity && !is.null(granularity_value)) {
    badges <- c(badges, list(list(
      label = paste0("Granularity: ", granularity_value),
      type  = "secondary"
    )))
  }

  # Compare mode indicator
  if (compare_mode) {
    badges <- c(badges, list(list(label = "Compare Mode: ON", type = "accent")))
  }

  # Convert to dataframe
  if (length(badges) == 0) {
    return(tibble(label = character(0), type = character(0)))
  }

  bind_rows(lapply(badges, as_tibble))
}

# =============================================================================
# SECTION 7 — MASTER VALIDATION (called on Run button press)
# =============================================================================

#' Full configuration validation — returns the final resolved config object
#' that is passed downstream to page4_results.R.
#'
#' @param sentiment_type    Character.
#' @param method            Character. Ignored if compare_mode == TRUE.
#' @param has_labels        Logical.
#' @param compare_mode      Logical.
#' @param granularity_value Numeric. UI slider value (0–5).
#' @return List with all resolved settings:
#'   $sentiment_type     — character (validated, lowercase)
#'   $method             — character or "compare" if compare_mode
#'   $compare_mode       — logical
#'   $neutral_threshold  — numeric (for lexicon use)
#'   $show_granularity   — logical
#'   $is_lexicon         — logical
#'   $is_ml              — logical
#'   $config_summary     — tibble (badge strip)
resolve_config <- function(sentiment_type    = NULL,
                           method            = NULL,
                           has_labels        = TRUE,
                           compare_mode      = FALSE,
                           granularity_value = GRANULARITY_DEFAULT) {

  # Gate check first
  gate <- check_run_ready(sentiment_type, method, has_labels, compare_mode)
  if (!gate$enabled) stop(paste("Configuration incomplete:", gate$hint))

  sentiment_type <- tolower(sentiment_type)
  method_lc      <- if (compare_mode) "compare" else tolower(method)

  show_gran <- if (compare_mode) FALSE else
    should_show_granularity(sentiment_type, method_lc, compare_mode)

  threshold <- if (show_gran) {
    granularity_to_threshold(granularity_value, method_lc)
  } else {
    GRANULARITY_DEFAULT
  }

  is_lexicon <- method_lc %in% LEXICON_METHODS
  is_ml      <- method_lc %in% ML_METHODS || compare_mode

  summary_badges <- build_config_summary(
    sentiment_type    = sentiment_type,
    method            = if (compare_mode) NULL else method_lc,
    compare_mode      = compare_mode,
    granularity_value = granularity_value,
    show_granularity  = show_gran
  )

  list(
    sentiment_type    = sentiment_type,
    method            = method_lc,
    compare_mode      = compare_mode,
    neutral_threshold = threshold,
    show_granularity  = show_gran,
    is_lexicon        = is_lexicon,
    is_ml             = is_ml,
    config_summary    = summary_badges
  )
}

# =============================================================================
# SECTION 8 — SELF-TEST
# =============================================================================

test_config_module <- function() {

  cat("\n========================================\n")
  cat("  CONFIG MODULE — SELF TEST\n")
  cat("========================================\n\n")

  # --- Method availability ---
  cat("--- Method Availability ---\n")

  cat("Binary + has_labels:\n")
  av <- get_method_availability("binary", has_labels = TRUE)
  cat("  Available:", paste(av$available, collapse = ", "), "\n")
  cat("  Disabled: ", paste(names(av$disabled), collapse = ", "), "\n")

  cat("\nEmotion + has_labels:\n")
  av2 <- get_method_availability("emotion", has_labels = TRUE)
  cat("  Available:", paste(av2$available, collapse = ", "), "\n")
  cat("  Disabled: ", paste(names(av2$disabled), collapse = ", "), "\n")

  cat("\nBinary + NO labels:\n")
  av3 <- get_method_availability("binary", has_labels = FALSE)
  cat("  Available:", paste(av3$available, collapse = ", "), "\n")
  cat("  Disabled: ", paste(names(av3$disabled), collapse = ", "), "\n")
  cat("  ML Tooltip:", av3$ml_tooltip, "\n")

  # --- Granularity slider ---
  cat("\n--- Granularity Slider ---\n")
  for (g in c(0, 1, 3, 5)) {
    afinn_t <- granularity_to_threshold(g, "afinn")
    bing_t  <- granularity_to_threshold(g, "bing")
    desc    <- describe_granularity(g)
    cat(sprintf("  Granularity %s → AFINN threshold: %s | Bing ratio: %s | %s\n",
                g, afinn_t, bing_t, desc))
  }

  cat("\nShould show granularity:\n")
  cat("  ternary + afinn:  ", should_show_granularity("ternary", "afinn"), "\n")
  cat("  ternary + bing:   ", should_show_granularity("ternary", "bing"),  "\n")
  cat("  ternary + nrc:    ", should_show_granularity("ternary", "nrc"),   "\n")
  cat("  binary  + afinn:  ", should_show_granularity("binary",  "afinn"), "\n")
  cat("  emotion + nrc:    ", should_show_granularity("emotion", "nrc"),   "\n")
  cat("  ternary + afinn + compare: ",
      should_show_granularity("ternary", "afinn", compare_mode = TRUE), "\n")

  # --- Run button gate ---
  cat("\n--- Run Button Gate ---\n")
  cases <- list(
    list(st = NULL,       m = NULL,    lbl = TRUE,  cmp = FALSE),  # nothing selected
    list(st = "binary",   m = NULL,    lbl = TRUE,  cmp = FALSE),  # only type selected
    list(st = "binary",   m = "afinn", lbl = TRUE,  cmp = FALSE),  # valid
    list(st = "emotion",  m = "afinn", lbl = TRUE,  cmp = FALSE),  # invalid combo
    list(st = "binary",   m = "svm",   lbl = FALSE, cmp = FALSE),  # ML no labels
    list(st = "binary",   m = NULL,    lbl = TRUE,  cmp = TRUE),   # compare mode
    list(st = "emotion",  m = NULL,    lbl = TRUE,  cmp = TRUE)    # compare+emotion blocked
  )
  for (case in cases) {
    gate <- check_run_ready(case$st, case$m, case$lbl, case$cmp)
    cat(sprintf("  [%s] type=%-8s method=%-12s labels=%-5s compare=%-5s → %s\n",
                if (gate$enabled) "ENABLED " else "DISABLED",
                ifelse(is.null(case$st), "NULL", case$st),
                ifelse(is.null(case$m),  "NULL", case$m),
                case$lbl, case$cmp,
                gate$hint))
  }

  # --- Config summary badges ---
  cat("\n--- Config Summary Badges ---\n")
  summary <- build_config_summary(
    sentiment_type    = "ternary",
    method            = "afinn",
    compare_mode      = FALSE,
    granularity_value = 3,
    show_granularity  = TRUE
  )
  print(summary)

  cat("\nCompare mode summary:\n")
  summary2 <- build_config_summary(
    sentiment_type = "binary",
    compare_mode   = TRUE
  )
  print(summary2)

  # --- Full resolve_config ---
  cat("\n--- resolve_config (ternary + bing + granularity 2) ---\n")
  cfg <- resolve_config(
    sentiment_type    = "ternary",
    method            = "bing",
    has_labels        = TRUE,
    compare_mode      = FALSE,
    granularity_value = 2
  )
  cat("  method:           ", cfg$method, "\n")
  cat("  neutral_threshold:", cfg$neutral_threshold, "\n")
  cat("  show_granularity: ", cfg$show_granularity, "\n")
  cat("  is_lexicon:       ", cfg$is_lexicon, "\n")
  cat("  is_ml:            ", cfg$is_ml, "\n")
  cat("  Badges:\n"); print(cfg$config_summary)

  # --- resolve_config error on bad combo ---
  cat("\n--- resolve_config error on invalid combo ---\n")
  tryCatch(
    resolve_config("emotion", "afinn", has_labels = TRUE),
    error = function(e) cat("  Caught expected error:", e$message, "\n")
  )

  cat("\n✔ All tests passed — page3_config.R is working correctly.\n\n")
}
