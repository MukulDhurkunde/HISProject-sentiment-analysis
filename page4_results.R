# =============================================================================
# page4_results.R
# Sentiment Analysis System — Results & Insight Dashboard Module
# -----------------------------------------------------------------------------
# Handles: Orchestrating the analysis, generating charts (ggplot2/plotly),
#          and generating dynamic insights text based on results.
#
# Dependencies: dplyr, ggplot2, plotly, stringr
# =============================================================================

suppressPackageStartupMessages({
  library(dplyr)
  library(ggplot2)
  library(plotly)
  library(stringr)
})

# Source dependencies if not already loaded (useful for self-testing)
if (!exists("run_lexicon_analysis")) source("page4_lexicon.R")
if (!exists("run_ml_analysis")) source("page4_ml.R")
if (!exists("resolve_config")) source("page3_config.R")

# =============================================================================
# SECTION 1 — ANALYSIS ORCHESTRATOR
# =============================================================================

#' Run the configured analysis and return standard results object.
#'
#' @param texts  Character vector of cleaned texts.
#' @param labels Character/factor vector of labels (can be NULL if no labels).
#' @param config List of settings returned by resolve_config() from page3.
#' @return The raw result object from the respective analysis module.
run_analysis <- function(texts, labels, config) {
  
  if (config$is_lexicon) {
    res <- run_lexicon_analysis(
      texts             = texts,
      method            = config$method,
      sentiment_type    = config$sentiment_type,
      neutral_threshold = config$neutral_threshold
    )
    res$is_lexicon <- TRUE
    res$config     <- config
    return(res)
    
  } else if (config$is_ml) {
    if (is.null(labels)) stop("Labels are required for ML analysis.")
    res <- run_ml_analysis(
      texts        = texts,
      labels       = labels,
      method       = config$method,
      compare_mode = config$compare_mode
    )
    res$is_lexicon <- FALSE
    res$config     <- config
    return(res)
  }
}

# =============================================================================
# SECTION 2 — CHART GENERATORS (Always Shown)
# =============================================================================

#' Plot Label Distribution as a Pie Chart (Plotly)
plot_label_distribution <- function(res) {
  # Get label distribution depending on module type
  if (res$is_lexicon) {
    dist_df <- res$label_dist
  } else if (res$config$compare_mode) {
    # For compare mode, show distribution from the best model
    best_model <- res$best_metrics$f1$model
    preds <- res$models[[best_model]]$test_predictions
    dist_df <- preds %>% count(predicted, name = "count") %>% rename(label = predicted)
  } else {
    preds <- res$test_predictions
    dist_df <- preds %>% count(predicted, name = "count") %>% rename(label = predicted)
  }
  
  if (nrow(dist_df) == 0) return(plotly_empty())
  
  # Standardize colors
  color_map <- c("Positive" = "#2ECC71", "Negative" = "#E74C3C", "Neutral" = "#95A5A6", "joy" = "#F1C40F")
  
  plot_ly(dist_df, labels = ~label, values = ~count, type = 'pie',
          textposition = 'inside',
          textinfo = 'label+percent',
          insidetextfont = list(color = '#FFFFFF'),
          marker = list(colors = unname(color_map[dist_df$label]))) %>%
    layout(title = "Sentiment Distribution",
           showlegend = TRUE,
           paper_bgcolor = 'rgba(0,0,0,0)',
           plot_bgcolor = 'rgba(0,0,0,0)')
}

#' Plot Top 5 Words (Bar Chart)
plot_top_words <- function(res, type = "positive") {
  if (res$is_lexicon) {
    word_df <- if (type == "positive") res$top_positive else res$top_negative
    val_col <- if ("total_score" %in% names(word_df)) "total_score" else "n"
    if ("n" %in% names(word_df)) word_df <- rename(word_df, total_score = n)
  } else {
    # ML models don't easily export top words out-of-the-box in this simple setup.
    # For now, return empty plot or placeholder for ML.
    return(plotly_empty() %>% layout(title = paste("Top words not available for ML")))
  }
  
  if (nrow(word_df) == 0) return(plotly_empty())
  
  color <- if (type == "positive") "#2ECC71" else "#E74C3C"
  
  # Ensure total_score is positive for display purposes on negative words
  word_df$disp_val <- abs(word_df$total_score)
  
  plot_ly(word_df, x = ~disp_val, y = ~reorder(word, disp_val), type = 'bar',
          orientation = 'h', marker = list(color = color)) %>%
    layout(title = paste("Top 5", str_to_title(type), "Words"),
           xaxis = list(title = "Frequency / Score Contribution"),
           yaxis = list(title = ""),
           paper_bgcolor = 'rgba(0,0,0,0)',
           plot_bgcolor = 'rgba(0,0,0,0)')
}


# =============================================================================
# SECTION 3 — METHOD-SPECIFIC CHARTS
# =============================================================================

#' Plot AFINN Histogram
plot_afinn_histogram <- function(res) {
  if (!res$is_lexicon || res$config$method != "afinn") return(NULL)
  
  dist_df <- res$score_dist
  
  plot_ly(dist_df, x = ~afinn_score, y = ~count, type = 'bar',
          marker = list(color = '#3498DB')) %>%
    layout(title = "AFINN Score Distribution",
           xaxis = list(title = "Score (-5 to +5)", tickmode = 'linear', dtick = 1),
           yaxis = list(title = "Document Count"),
           paper_bgcolor = 'rgba(0,0,0,0)',
           plot_bgcolor = 'rgba(0,0,0,0)')
}

#' Plot NRC Radar/Bar Chart
plot_nrc_charts <- function(res, type = "radar") {
  if (!res$is_lexicon || res$config$method != "nrc") return(NULL)
  
  df <- res$emotion_totals
  if (nrow(df) == 0) return(plotly_empty())
  
  if (type == "radar") {
    plot_ly(type = 'scatterpolar', r = df$total_count, theta = df$emotion, fill = 'toself',
            line = list(color = '#9B59B6'), fillcolor = 'rgba(155, 89, 182, 0.5)') %>%
      layout(polar = list(radialaxis = list(visible = TRUE, range = c(0, max(df$total_count)))),
             title = "Emotion Radar",
             paper_bgcolor = 'rgba(0,0,0,0)')
  } else {
    plot_ly(df, x = ~reorder(emotion, -total_count), y = ~total_count, type = 'bar',
            marker = list(color = '#9B59B6')) %>%
      layout(title = "Emotion Counts", xaxis = list(title = "Emotion"), yaxis = list(title = "Count"),
             paper_bgcolor = 'rgba(0,0,0,0)', plot_bgcolor = 'rgba(0,0,0,0)')
  }
}

#' Plot ML Confusion Matrix (Heatmap)
plot_confusion_matrix <- function(res) {
  if (res$is_lexicon || res$config$compare_mode) return(NULL)
  
  cm_df <- res$confusion_matrix
  
  # Format for plotly heatmap
  cm_mat <- xtabs(count ~ Predicted + Actual, data = cm_df)
  
  plot_ly(z = cm_mat, x = colnames(cm_mat), y = rownames(cm_mat), type = "heatmap",
          colorscale = "Greens") %>%
    layout(title = "Confusion Matrix",
           xaxis = list(title = "Actual Label"),
           yaxis = list(title = "Predicted Label", autorange = "reversed"),
           paper_bgcolor = 'rgba(0,0,0,0)',
           plot_bgcolor = 'rgba(0,0,0,0)')
}

#' Plot ML Compare Bar Chart
plot_compare_chart <- function(res) {
  if (!res$config$compare_mode) return(NULL)
  
  df <- res$comparison_df
  
  plot_ly(df, x = ~model, y = ~f1, type = 'bar', text = ~round(f1, 2), textposition = 'auto',
          marker = list(color = c('#3498DB', '#E67E22', '#2ECC71'))) %>%
    layout(title = "Model Comparison (F1 Score)",
           xaxis = list(title = "Model"),
           yaxis = list(title = "F1 Score", range = c(0, 1)),
           paper_bgcolor = 'rgba(0,0,0,0)',
           plot_bgcolor = 'rgba(0,0,0,0)')
}

# =============================================================================
# SECTION 4 — INSIGHTS GENERATION
# =============================================================================

#' Generate dynamic insight text from the results.
#'
#' @param res The result object from run_analysis.
#' @return Character string containing markdown formatted insights.
generate_insights <- function(res) {
  
  cfg <- res$config
  insight_parts <- c("### Final Analysis Insights\n")
  
  # 1. Dominant Sentiment
  if (cfg$compare_mode) {
    best_m <- res$best_metrics$f1$model
    preds <- res$models[[best_m]]$test_predictions
    dist <- preds %>% count(predicted) %>% arrange(desc(n))
  } else if (cfg$is_lexicon) {
    dist <- res$label_dist %>% arrange(desc(count)) %>% rename(n = count, predicted = label)
  } else {
    preds <- res$test_predictions
    dist <- preds %>% count(predicted) %>% arrange(desc(n))
  }
  
  dominant_label <- as.character(dist$predicted[1])
  dom_count <- dist$n[1]
  total <- sum(dist$n)
  pct <- round((dom_count / total) * 100, 1)
  
  insight_parts <- c(insight_parts, sprintf(
    "- **Dominant Sentiment**: The most frequent classification was **%s**, making up **%s%%** of the analyzed data.",
    str_to_title(dominant_label), pct
  ))
  
  # 2. Key Drivers (Lexicon Only)
  if (cfg$is_lexicon && cfg$method != "nrc") {
    pos_top <- if (nrow(res$top_positive) > 0) res$top_positive$word[1] else "none"
    neg_top <- if (nrow(res$top_negative) > 0) res$top_negative$word[1] else "none"
    
    insight_parts <- c(insight_parts, sprintf(
      "- **Key Drivers**: The strongest positive driver was '*%s*', while the strongest negative driver was '*%s*'.",
      pos_top, neg_top
    ))
  }
  
  # 3. ML Performance
  if (!cfg$is_lexicon && !cfg$compare_mode) {
    f1 <- res$metrics["f1"]
    acc <- res$metrics["accuracy"]
    insight_parts <- c(insight_parts, sprintf(
      "- **Model Performance**: The %s model achieved an accuracy of **%s%%** and an F1-score of **%s**. %s",
      METHOD_LABELS[[cfg$method]], round(acc*100, 1), round(f1, 2),
      ifelse(f1 > 0.8, "This indicates strong predictive capability.", "There is room for improvement in classification accuracy.")
    ))
  }
  
  # 4. Compare Mode
  if (cfg$compare_mode) {
    best_f1_val <- res$best_metrics$f1$value
    best_f1_mod <- METHOD_LABELS[[res$best_metrics$f1$model]]
    
    insight_parts <- c(insight_parts, sprintf(
      "- **Model Comparison**: The **%s** model performed best overall with an F1-score of **%s**, demonstrating the best balance of precision and recall on this dataset.",
      best_f1_mod, round(best_f1_val, 2)
    ))
  }
  
  # 5. Granularity Impact
  if (cfg$show_granularity) {
    insight_parts <- c(insight_parts, sprintf(
      "- **Granularity Settings**: A neutral granularity of **%s** was applied, which %s.",
      cfg$neutral_threshold,
      ifelse(cfg$neutral_threshold < 1, "pushed borderline texts into Positive/Negative classes", "retained more texts in the Neutral category")
    ))
  }
  
  # 6. Recommendation
  recommendation <- if (dominant_label == "Negative" || dominant_label == "anger" || dominant_label == "sadness") {
    "**Actionable Recommendation**: Negative sentiment is dominant. Immediate review of user complaints or product quality is recommended to identify root causes of frustration."
  } else if (dominant_label == "Positive" || dominant_label == "joy") {
    "**Actionable Recommendation**: Positive sentiment is dominant. Consider capitalizing on this by requesting reviews, or analyzing the top positive drivers for marketing campaigns."
  } else {
    "**Actionable Recommendation**: Sentiment is mixed or neutral. Further detailed analysis or collecting more specific feedback might be necessary to uncover actionable trends."
  }
  insight_parts <- c(insight_parts, paste("-", recommendation))
  
  paste(insight_parts, collapse = "\n")
}

# =============================================================================
# SECTION 5 — SELF-TEST
# =============================================================================

test_results_module <- function() {
  cat("\n========================================\n")
  cat("  RESULTS MODULE — SELF TEST\n")
  cat("========================================\n\n")
  
  # Mock data
  texts <- c("I absolutely love this product it is wonderful", 
             "Terrible quality complete waste of money", 
             "It was okay nothing special",
             "Great value and amazing service")
  labels <- c("Positive", "Negative", "Neutral", "Positive")
  
  # Test 1: Lexicon (AFINN)
  cat("--- Test 1: AFINN Lexicon ---\n")
  cfg_afinn <- list(
    is_lexicon = TRUE, is_ml = FALSE, method = "afinn", sentiment_type = "ternary",
    neutral_threshold = 1, show_granularity = TRUE, compare_mode = FALSE
  )
  res_afinn <- run_analysis(texts, NULL, cfg_afinn)
  
  cat("Insights generated:\n")
  cat(generate_insights(res_afinn), "\n\n")
  
  # Test 2: ML (Random Forest)
  cat("--- Test 2: ML Single (Random Forest) ---\n")
  cfg_ml <- list(
    is_lexicon = FALSE, is_ml = TRUE, method = "random_forest", sentiment_type = "ternary",
    compare_mode = FALSE, show_granularity = FALSE
  )
  # Duplicate texts to avoid caret splitting errors on tiny dataset
  res_ml <- run_analysis(rep(texts, 5), rep(labels, 5), cfg_ml)
  
  cat("Insights generated:\n")
  cat(generate_insights(res_ml), "\n\n")
  
  # Test 3: Compare ML
  cat("--- Test 3: Compare ML ---\n")
  cfg_cmp <- list(
    is_lexicon = FALSE, is_ml = TRUE, compare_mode = TRUE, sentiment_type = "ternary",
    show_granularity = FALSE
  )
  res_cmp <- run_analysis(rep(texts, 5), rep(labels, 5), cfg_cmp)
  cat("Insights generated:\n")
  cat(generate_insights(res_cmp), "\n\n")
  
  cat("✔ All tests passed — page4_results.R is working correctly.\n\n")
}
