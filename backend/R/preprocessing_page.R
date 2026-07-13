# preprocessing_page.R: Handles text cleaning, normalization, and missing data strategies.

# Auto-install stringr and dplyr if missing
for (pkg in c("stringr", "dplyr")) {
  if (!requireNamespace(pkg, quietly = TRUE)) {
    cat(sprintf("Installing package '%s'...\n", pkg))
    dir.create(Sys.getenv("R_LIBS_USER"), recursive = TRUE, showWarnings = FALSE)
    suppressMessages(install.packages(pkg, lib = Sys.getenv("R_LIBS_USER"),
                                      repos = "https://cloud.r-project.org", quiet = TRUE))
  }
}
library(stringr)
library(dplyr)

handle_missing_text <- function(df, columns, strategy) {
  if (is.null(df) || length(columns) == 0) return(df)
  
  if (strategy == "deletion") {
    for (col in columns) {
      df <- df %>%
        filter(!is.na(.data[[col]]) & str_trim(.data[[col]]) != "")
    }
  } else if (strategy == "skip") {
    missing_mask <- rep(FALSE, nrow(df))
    for (col in columns) {
      missing_mask <- missing_mask | (is.na(df[[col]]) | str_trim(df[[col]]) == "")
    }
    for (col in columns) {
      df[[col]][missing_mask] <- "[No Review]"
    }
  }
  
  return(df)
}

remove_urls_html <- function(text) {
  res <- str_replace_all(text, "<[^>]*>?", " ")
  res <- str_replace_all(res, "(https?:\\/\\/[^\\s]+)", " ")
  res <- str_replace_all(res, "(www\\.[^\\s]+)", " ")
  res <- str_squish(res)
  return(res)
}

convert_lowercase <- function(text) {
  return(tolower(text))
}

# Expand contractions to preserve negation signals
expand_contractions <- function(text) {
  contractions <- c(
    "won't"      = "will not",
    "can't"      = "cannot",
    "shan't"     = "shall not",
    "n't"        = " not",
    "i'm"        = "i am",
    "you're"     = "you are",
    "we're"      = "we are",
    "they're"    = "they are",
    "he's"       = "he is",
    "she's"      = "she is",
    "it's"       = "it is",
    "that's"     = "that is",
    "there's"    = "there is",
    "here's"     = "here is",
    "what's"     = "what is",
    "who's"      = "who is",
    "how's"      = "how is",
    "where's"    = "where is",
    "let's"      = "let us",
    "i've"       = "i have",
    "you've"     = "you have",
    "we've"      = "we have",
    "they've"    = "they have",
    "i'll"       = "i will",
    "you'll"     = "you will",
    "he'll"      = "he will",
    "she'll"     = "she will",
    "we'll"      = "we will",
    "they'll"    = "they will",
    "i'd"        = "i would",
    "you'd"      = "you would",
    "he'd"       = "he would",
    "she'd"      = "she would",
    "we'd"       = "we would",
    "they'd"     = "they would",
    "'s"         = "",
    "'re"        = " are",
    "'ve"        = " have",
    "'ll"        = " will",
    "'d"         = " would",
    "'m"         = " am"
  )

  res <- text
  for (pattern in names(contractions)) {
    replacement <- contractions[[pattern]]
    res <- str_replace_all(res, fixed(pattern), replacement)
    curly_pattern <- gsub("'", "\u2019", pattern)
    res <- str_replace_all(res, fixed(curly_pattern), replacement)
    backtick_pattern <- gsub("'", "`", pattern)
    res <- str_replace_all(res, fixed(backtick_pattern), replacement)
  }
  res <- str_squish(res)
  return(res)
}

remove_punctuation <- function(text) {
  res <- str_replace_all(text, "[.,;:?!'\"()\\[\\]{}\\-\u2026\u2014\u2013\u201C\u201D\u2018\u2019]", " ")
  res <- str_squish(res)
  return(res)
}

remove_special_chars <- function(text) {
  res <- str_replace_all(text, "[@#$%^&*_=+~`|\\\\/><]", " ")
  res <- str_squish(res)
  return(res)
}

remove_numbers <- function(text) {
  res <- str_replace_all(text, "[0-9]+", " ")
  res <- str_squish(res)
  return(res)
}

# Keeps negation/sentiment words like 'not', 'no', 'like'
remove_stopwords <- function(text) {
  stops <- c(
    "a", "an", "the", "this", "that", "these", "those",
    "i", "me", "my", "myself", "we", "our", "ours", "ourselves",
    "you", "your", "yours", "yourself", "yourselves",
    "he", "him", "his", "himself",
    "she", "her", "hers", "herself",
    "it", "its", "itself",
    "they", "them", "their", "theirs", "themselves",
    "in", "on", "at", "to", "for", "of", "with", "by",
    "from", "up", "about", "into", "through", "during",
    "before", "after", "above", "below", "between",
    "out", "off", "over", "under", "again", "further",
    "then", "once", "and", "but", "or", "so", "yet",
    "am", "is", "are", "was", "were", "be", "been", "being",
    "has", "have", "had", "having",
    "do", "does", "did", "doing",
    "will", "would", "shall", "should",
    "can", "could", "may", "might", "must",
    "what", "which", "who", "whom", "when", "where", "why", "how",
    "all", "each", "every", "both", "few", "more", "most",
    "other", "some", "such", "only", "own", "same",
    "than", "too", "very",
    "just", "because", "as", "until", "while",
    "if", "else", "also", "here", "there",
    "any", "many", "much", "now",
    "well", "way", "even", "new",
    "use", "used",
    "make",
    "going", "know", "take",
    "come", "get", "go", "got",
    "need", "think", "see", "look",
    "give", "tell", "say", "said",
    "one", "two",
    "back", "still",
    "right", "around",
    "down", "another",
    "however", "really",
    "since", "whether",
    "enough", "already",
    "though", "although",
    "let"
  )

  stops <- unique(stops)

  pattern <- paste0("\\b(", paste(stops, collapse = "|"), ")\\b")
  
  res <- str_replace_all(text, regex(pattern, ignore_case = TRUE), " ")
  res <- str_squish(res)
  
  return(res)
}

# Applies transformations in strict order
transform_text <- function(text, config) {
  res <- as.character(text)
  
  res[is.na(res)] <- ""
  
  if (isTRUE(config$removeUrlsHtml)) {
    res <- remove_urls_html(res)
  }

  if (isTRUE(config$lowercase)) {
    res <- convert_lowercase(res)
  }

  if (isTRUE(config$stopwords) || isTRUE(config$punctuation)) {
    res <- expand_contractions(res)
  }

  if (isTRUE(config$stopwords)) {
    res <- remove_stopwords(res)
  }

  if (isTRUE(config$punctuation)) {
    res <- remove_punctuation(res)
  }

  if (isTRUE(config$specialChars)) {
    res <- remove_special_chars(res)
  }

  if (isTRUE(config$numbers)) {
    res <- remove_numbers(res)
  }
  
  return(str_trim(res))
}

apply_preprocessing <- function(df, columns, missing_strategy, config) {
  
  df_clean <- handle_missing_text(df, columns, missing_strategy)
  
  text_col <- columns[1]

  raw_texts_by_col <- list()
  for (col in columns) {
    raw_texts_by_col[[col]] <- df_clean[[col]]
  }

  all_raw_samples <- c()
  all_transformed_samples <- c()
  
  raw_texts <- df_clean[[text_col]]
  transformed_texts <- transform_text(raw_texts, config)
  df_clean[[text_col]] <- transformed_texts
  
  all_raw_samples <- raw_texts
  all_transformed_samples <- transformed_texts
  
  stats <- compute_preprocessing_stats(
    all_raw_samples, 
    all_transformed_samples, 
    nrow(df_clean),
    config
  )
  
  preview <- list()
  for (col in columns) {
    preview[[col]] <- data.frame(
      raw = head(raw_texts_by_col[[col]], 20),
      transformed = head(df_clean[[col]], 20)
    )
  }
  
  return(list(
    processed_df = df_clean,
    stats = stats,
    preview = preview
  ))
}

compute_preprocessing_stats <- function(raw_texts, transformed_texts, total_rows, config) {
  active_toggles <- sum(unlist(config))
  
  cleaned_records <- total_rows
  
  all_words <- unlist(str_split(transformed_texts[transformed_texts != ""], "\\s+"))
  all_words <- all_words[all_words != ""]
  vocab_size <- length(unique(all_words))
  
  raw_no_space <- gsub("\\s+", "", raw_texts)
  trans_no_space <- gsub("\\s+", "", transformed_texts)
  
  raw_total <- sum(nchar(raw_no_space), na.rm = TRUE)
  transformed_total <- sum(nchar(trans_no_space), na.rm = TRUE)
  
  noise_reduction <- 0
  if (raw_total > 0) {
    noise_reduction <- round((1 - (transformed_total / raw_total)) * 100, 1)
  }
  
  if (noise_reduction < 0) {
    noise_reduction <- 0
  }
  
  return(list(
    cleaned_records = cleaned_records,
    vocab_size = vocab_size,
    noise_reduction = noise_reduction
  ))
}
