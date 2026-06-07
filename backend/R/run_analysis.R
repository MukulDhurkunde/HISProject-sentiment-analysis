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
} else {
  df$emotional_themes <- ""
}

# Write output JSON
out_json <- toJSON(list(processed_rows = df), auto_unbox = TRUE, pretty = TRUE)
write(out_json, outfile)

cat("Analysis complete.\n")
