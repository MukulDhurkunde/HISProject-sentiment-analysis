args <- commandArgs(trailingOnly = TRUE)
if (length(args) < 2) {
  stop("Usage: Rscript run_analysis.R <infile.json> <outfile.json>")
}

infile <- args[1]
outfile <- args[2]

# Ensure required packages are installed quietly
install_if_missing <- function(pkg) {
  if (!requireNamespace(pkg, quietly = TRUE)) {
    cat(sprintf("Installing package '%s'...\n", pkg))
    dir.create(Sys.getenv("R_LIBS_USER"), recursive = TRUE, showWarnings = FALSE)
    suppressMessages(install.packages(pkg, lib = Sys.getenv("R_LIBS_USER"), repos = "http://cran.rstudio.com/", quiet = TRUE))
  }
}

suppressWarnings({
  suppressMessages({
    install_if_missing("jsonlite")
    install_if_missing("syuzhet")
    library(jsonlite)
    library(syuzhet)
  })
})

# Read input JSON
payload <- fromJSON(infile)

df_rows <- payload$df_rows
text_column <- payload$text_column
lexicon <- payload$lexicon       # "afinn", "bing", or "nrc"
sensitivity <- payload$sensitivity # 0 to 100
theme_count <- payload$theme_count # numeric (only applies to nrc)

# Convert to dataframe if it isn't already
df <- as.data.frame(df_rows)

if (!text_column %in% colnames(df)) {
  stop(sprintf("Text column '%s' not found in dataset", text_column))
}

texts <- as.character(df[[text_column]])

# Sensitivity -> Threshold mapping
# Sensitivity 100 -> threshold 0 (any non-zero is polzarized)
# Sensitivity 0   -> threshold 2.0 (needs a strong score)
max_threshold <- 2.0
threshold <- max_threshold * (1 - (sensitivity / 100))

# Initialize output lists
scores <- numeric(length(texts))
labels <- character(length(texts))
top_themes <- vector("list", length(texts))

if (lexicon == "nrc") {
  # NRC returns a dataframe of 10 columns
  nrc_data <- suppressWarnings(suppressMessages(get_nrc_sentiment(texts)))
  
  # The overall sentiment score can be positive - negative
  scores <- nrc_data$positive - nrc_data$negative
  
  # The 8 emotions
  emotions <- c("anger", "anticipation", "disgust", "fear", "joy", "sadness", "surprise", "trust")
  
  for (i in seq_len(nrow(nrc_data))) {
    # Extract row
    row_emotions <- unlist(nrc_data[i, emotions])
    # Sort descending
    sorted_emotions <- sort(row_emotions, decreasing = TRUE)
    # Filter to non-zero
    non_zero <- sorted_emotions[sorted_emotions > 0]
    
    # Take top N (theme_count)
    if (length(non_zero) > 0) {
      top_n <- head(names(non_zero), n = theme_count)
      # Capitalize first letter
      top_n <- paste0(toupper(substr(top_n, 1, 1)), substring(top_n, 2))
      top_themes[[i]] <- top_n
    } else {
      top_themes[[i]] <- character(0)
    }
    
    # Label logic
    if (scores[i] > threshold) {
      labels[i] <- "Positive"
    } else if (scores[i] < -threshold) {
      labels[i] <- "Negative"
    } else {
      labels[i] <- "Neutral"
    }
  }
} else {
  # For Bing or AFINN
  scores <- suppressWarnings(suppressMessages(get_sentiment(texts, method = lexicon)))
  
  for (i in seq_along(scores)) {
    if (scores[i] > threshold) {
      labels[i] <- "Positive"
    } else if (scores[i] < -threshold) {
      labels[i] <- "Negative"
    } else {
      labels[i] <- "Neutral"
    }
    top_themes[[i]] <- character(0) # Empty for non-NRC
  }
}

# Append to dataframe
df$sentiment_score <- scores
df$sentiment_label <- labels

if (lexicon == "nrc") {
  # Convert list of strings to a comma-separated string per row
  df$emotional_themes <- vapply(top_themes, paste, collapse = ", ", FUN.VALUE = character(1))
  # Append individual NRC emotion columns for the heatmap
  for (emo in emotions) {
    df[[paste0("nrc_", emo)]] <- nrc_data[[emo]]
  }
} else {
  df$emotional_themes <- ""
}

# === INSIGHTS GENERATION ===
mixed_rows <- 0
low_conf_rows <- 0
rec_text <- ""

if (lexicon == "nrc") {
  mixed_rows <- sum(nrc_data$positive > 0 & nrc_data$negative > 0)
  total_matches <- rowSums(nrc_data)
  low_conf_rows <- sum(total_matches <= 2)
  
  emotion_sums <- colSums(nrc_data[, c("anger", "anticipation", "disgust", "fear", "joy", "sadness", "surprise", "trust")])
  if (sum(emotion_sums) > 0) {
    dom_emo <- names(emotion_sums)[which.max(emotion_sums)]
    dom_emo_percent <- round((sum(nrc_data[[dom_emo]] > 0) / nrow(nrc_data)) * 100, 1)
    rec_text <- sprintf("The dominant emotional signal across the dataset is '%s', appearing in %s%% of all classified texts.", toupper(dom_emo), dom_emo_percent)
  } else {
    rec_text <- "No dominant emotional signals detected in the dataset."
  }
} else {
  # For Bing/AFINN, we tokenize and count manually for insights
  all_neg_words <- character(0)
  
  for (i in seq_along(texts)) {
    toks <- get_tokens(texts[i])
    if (length(toks) > 0) {
      scores_word <- get_sentiment(toks, method = lexicon)
      pos_count <- sum(scores_word > 0)
      neg_count <- sum(scores_word < 0)
      
      if (pos_count > 0 && neg_count > 0) {
        mixed_rows <- mixed_rows + 1
      }
      if ((pos_count + neg_count) <= 2) {
        low_conf_rows <- low_conf_rows + 1
      }
      if (labels[i] == "Negative") {
        neg_toks <- toks[scores_word < 0]
        all_neg_words <- c(all_neg_words, neg_toks)
      }
    } else {
      low_conf_rows <- low_conf_rows + 1
    }
  }
  
  if (length(all_neg_words) > 0) {
    word_freqs <- sort(table(all_neg_words), decreasing = TRUE)
    top_word <- names(word_freqs)[1]
    
    neg_indices <- which(labels == "Negative")
    contains_top <- sum(grepl(top_word, texts[neg_indices], ignore.case = TRUE))
    percent_share <- round((contains_top / length(neg_indices)) * 100, 1)
    
    rec_text <- sprintf("%s%% of negative reviews share common language around '%s' — suggesting this is a primary concern in the dataset.", percent_share, top_word)
  } else {
    rec_text <- "Not enough negative reviews to form a reliable word cluster recommendation."
  }
}

total_rows <- length(texts)
low_conf_percent <- round((low_conf_rows / total_rows) * 100, 1)

insights <- list(
  conflict_detection = sprintf("%s reviews contain mixed sentiment signals \u2014 both positive and negative language detected in the same text.", mixed_rows),
  confidence_warning = sprintf("%s%% of classifications were made with low confidence due to weak sentiment signals. Treat these results with caution.", low_conf_percent),
  actionable_recommendation = rec_text
)

# === CHART DATA FOR DASHBOARD ===

if (lexicon == "bing") {
  # Compute top positive and negative word frequencies for the Bing bar chart
  all_pos_words <- character(0)
  all_neg_words_chart <- character(0)
  
  for (i in seq_along(texts)) {
    toks <- get_tokens(texts[i])
    if (length(toks) > 0) {
      scores_w <- get_sentiment(toks, method = "bing")
      all_pos_words <- c(all_pos_words, toks[scores_w > 0])
      all_neg_words_chart <- c(all_neg_words_chart, toks[scores_w < 0])
    }
  }
  
  pos_freq <- sort(table(all_pos_words), decreasing = TRUE)
  neg_freq <- sort(table(all_neg_words_chart), decreasing = TRUE)
  
  top_pos <- head(pos_freq, 10)
  top_neg <- head(neg_freq, 10)
  
  insights$bing_word_freqs <- list(
    positive = data.frame(word = names(top_pos), count = as.integer(top_pos), stringsAsFactors = FALSE),
    negative = data.frame(word = names(top_neg), count = as.integer(top_neg), stringsAsFactors = FALSE)
  )
}

if (lexicon == "nrc") {
  # Compute average emotion scores grouped by polarity for the heatmap
  emos <- c("anger", "anticipation", "disgust", "fear", "joy", "sadness", "surprise", "trust")
  by_polarity <- list()
  
  for (pol in c("Positive", "Neutral", "Negative")) {
    idx <- which(labels == pol)
    if (length(idx) > 0) {
      avg_vals <- colMeans(nrc_data[idx, emos, drop = FALSE])
      avg_vals <- round(avg_vals, 2)
      by_polarity[[pol]] <- as.list(avg_vals)
    } else {
      zeroes <- as.list(setNames(rep(0, length(emos)), emos))
      by_polarity[[pol]] <- zeroes
    }
  }
  
  insights$nrc_emotion_matrix <- list(
    emotions = emos,
    by_polarity = by_polarity
  )
}

# Write output JSON
out_json <- toJSON(list(
  processed_rows = df,
  insights = insights
), auto_unbox = TRUE, pretty = TRUE)
write(out_json, outfile)

cat("Analysis complete.\n")
