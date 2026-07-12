# dashboard_page.R: Generates insights and chart data for the Dashboard.

mixed_rows    <- 0
low_conf_rows <- 0
rec_text      <- ""

if (lexicon == "nrc") {
  mixed_rows    <- sum(nrc_data$positive > 0 & nrc_data$negative > 0)
  total_matches <- rowSums(nrc_data)
  low_conf_rows <- sum(total_matches <= 2)

  emotion_sums <- colSums(nrc_data[, c("anger","anticipation","disgust","fear","joy","sadness","surprise","trust")])
  if (sum(emotion_sums) > 0) {
    dom_emo         <- names(emotion_sums)[which.max(emotion_sums)]
    dom_emo_percent <- round((sum(nrc_data[[dom_emo]] > 0) / nrow(nrc_data)) * 100, 1)
    rec_text <- sprintf("The dominant emotional signal across the dataset is '%s', appearing in %s%% of all classified texts.",
                        toupper(dom_emo), dom_emo_percent)
  } else {
    rec_text <- "No dominant emotional signals detected in the dataset."
  }
} else {
  all_neg_words <- character(0)

  for (i in seq_along(texts)) {
    toks <- get_tokens(texts[i])
    if (length(toks) > 0) {
      scores_word <- get_sentiment(toks, method = lexicon)
      pos_count   <- sum(scores_word > 0)
      neg_count   <- sum(scores_word < 0)
      if (pos_count > 0 && neg_count > 0) mixed_rows    <- mixed_rows + 1
      if ((pos_count + neg_count) <= 2)   low_conf_rows <- low_conf_rows + 1
      if (labels[i] == "Negative")        all_neg_words <- c(all_neg_words, toks[scores_word < 0])
    } else {
      low_conf_rows <- low_conf_rows + 1
    }
  }

  if (length(all_neg_words) > 0) {
    word_freqs   <- sort(table(all_neg_words), decreasing = TRUE)
    top_word     <- names(word_freqs)[1]
    neg_indices  <- which(labels == "Negative")
    contains_top <- sum(grepl(top_word, texts[neg_indices], ignore.case = TRUE))
    pct_share    <- round((contains_top / length(neg_indices)) * 100, 1)
    rec_text <- sprintf("%s%% of negative reviews share common language around '%s' — suggesting this is a primary concern in the dataset.",
                        pct_share, top_word)
  } else {
    rec_text <- "Not enough negative reviews to form a reliable word cluster recommendation."
  }
}

total_rows       <- length(texts)
low_conf_percent <- round((low_conf_rows / total_rows) * 100, 1)

insights <- list(
  conflict_detection        = sprintf("%s reviews contain mixed sentiment signals — both positive and negative language detected in the same text.", mixed_rows),
  confidence_warning        = sprintf("%s%% of classifications were made with low confidence due to weak sentiment signals. Treat these results with caution.", low_conf_percent),
  actionable_recommendation = rec_text
)



if (lexicon == "bing") {
  all_pos_words       <- character(0)
  all_neg_words_chart <- character(0)

  for (i in seq_along(texts)) {
    toks <- get_tokens(texts[i])
    if (length(toks) > 0) {
      scores_w            <- get_sentiment(toks, method = "bing")
      all_pos_words       <- c(all_pos_words,       toks[scores_w > 0])
      all_neg_words_chart <- c(all_neg_words_chart, toks[scores_w < 0])
    }
  }

  pos_freq <- sort(table(all_pos_words),       decreasing = TRUE)
  neg_freq <- sort(table(all_neg_words_chart), decreasing = TRUE)
  top_pos  <- head(pos_freq, 10)
  top_neg  <- head(neg_freq, 10)

  insights$bing_word_freqs <- list(
    positive = data.frame(word = names(top_pos), count = as.integer(top_pos), stringsAsFactors = FALSE),
    negative = data.frame(word = names(top_neg), count = as.integer(top_neg), stringsAsFactors = FALSE)
  )
}



if (lexicon == "nrc") {
  emos        <- c("anger","anticipation","disgust","fear","joy","sadness","surprise","trust")
  by_polarity <- list()

  for (pol in c("Positive","Neutral","Negative")) {
    idx <- which(labels == pol)
    if (length(idx) > 0) {
      avg_vals           <- round(colMeans(nrc_data[idx, emos, drop = FALSE]), 2)
      by_polarity[[pol]] <- as.list(avg_vals)
    } else {
      by_polarity[[pol]] <- as.list(setNames(rep(0, length(emos)), emos))
    }
  }

  insights$nrc_emotion_matrix <- list(emotions = emos, by_polarity = by_polarity)
}



if (lexicon == "bing") {
  dict  <- get_sentiment_dictionary("bing")
  pos_w <- dict$word[dict$value > 0]
  neg_w <- dict$word[dict$value < 0]
} else if (lexicon == "afinn") {
  dict  <- get_sentiment_dictionary("afinn")
  pos_w <- dict$word[dict$value > 0]
  neg_w <- dict$word[dict$value < 0]
} else if (lexicon == "nrc") {
  dict  <- get_sentiment_dictionary("nrc")
  pos_w <- dict$word[dict$sentiment == "positive" & dict$value > 0]
  neg_w <- dict$word[dict$sentiment == "negative" & dict$value > 0]
}

insights$lexicon_words <- list(positive = unique(pos_w), negative = unique(neg_w))
