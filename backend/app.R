# =============================================================================
# app.R
# Sentiment Analysis System — Main Application Entry Point
# -----------------------------------------------------------------------------
# Handles: Shiny UI, Reactive State, Step-by-Step Navigation
# =============================================================================

suppressPackageStartupMessages({
  library(shiny)
  library(dplyr)
  library(ggplot2)
  library(plotly)
  library(readr)
})

# Source all modules
source("page1_input.R")
source("page2_cleaning.R")
source("page3_config.R")
source("page4_results.R")
source("page4_lexicon.R")
source("page4_ml.R")

# Custom CSS for a clean, minimal interface
custom_css <- "
  body { background-color: #ffffff; color: #333333; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; }
  .well { background-color: #f8f9fa; border: 1px solid #e9ecef; border-radius: 8px; box-shadow: none; }
  .btn-primary { background-color: #007bff; border: none; border-radius: 4px; padding: 10px 20px; }
  .btn-primary:disabled { background-color: #cccccc; cursor: not-allowed; }
  .kpi-card { background-color: #f8f9fa; border-left: 4px solid #007bff; padding: 15px; margin-bottom: 15px; border-radius: 4px; }
  .kpi-value { font-size: 24px; font-weight: bold; color: #007bff; }
  .kpi-title { font-size: 12px; text-transform: uppercase; color: #6c757d; }
  .nav-header { padding: 15px 0; border-bottom: 1px solid #e9ecef; margin-bottom: 20px; }
  .badge { padding: 5px 10px; margin-right: 5px; font-size: 14px; }
  .badge-primary { background-color: #007bff; color: white; }
  .badge-secondary { background-color: #6c757d; color: white; }
  .badge-accent { background-color: #e83e8c; color: white; }
"

# =============================================================================
# UI DEFINITION
# =============================================================================

ui <- fluidPage(
  tags$head(tags$style(HTML(custom_css))),
  
  div(class = "nav-header",
      h2("Sentiment Analysis System", style = "margin-top: 0;")
  ),
  
  # Hidden tabset for navigation
  tabsetPanel(
    id = "main_tabs",
    type = "hidden",
    
    # -------------------------------------------------------------------------
    # PAGE 1: Input & Initial Analysis
    # -------------------------------------------------------------------------
    tabPanel("page1",
             h3("Step 1: Data Input & Initial Analysis"),
             fluidRow(
               column(4,
                      wellPanel(
                        radioButtons("input_source", "Select Data Source:",
                                     choices = c("Upload CSV" = "csv", "Paste Text" = "paste")),
                        conditionalPanel(
                          condition = "input.input_source == 'csv'",
                          fileInput("file_upload", "Choose CSV File", accept = ".csv")
                        ),
                        conditionalPanel(
                          condition = "input.input_source == 'paste'",
                          textAreaInput("text_paste", "Paste Text (one document per line)", rows = 10)
                        ),
                        actionButton("btn_load_data", "Load Data", class = "btn-primary", width = "100%")
                      )
               ),
               column(8,
                      uiOutput("page1_results"),
                      uiOutput("page1_nav")
               )
             )
    ),
    
    # -------------------------------------------------------------------------
    # PAGE 2: Text Cleaning & Exploration
    # -------------------------------------------------------------------------
    tabPanel("page2",
             h3("Step 2: Text Cleaning & Exploration"),
             fluidRow(
               column(4,
                      wellPanel(
                        h4("Cleaning Pipeline"),
                        checkboxInput("clean_lower", "Lowercase", value = TRUE),
                        checkboxInput("clean_punct", "Remove punctuation", value = TRUE),
                        checkboxInput("clean_numbers", "Remove numbers", value = TRUE),
                        checkboxInput("clean_stops", "Remove stopwords", value = TRUE),
                        checkboxInput("clean_stem", "Stemming", value = TRUE),
                        checkboxInput("clean_urls", "Remove URLs / HTML", value = TRUE),
                        hr(),
                        h4("Token Metrics"),
                        uiOutput("cleaning_metrics")
                      )
               ),
               column(8,
                      wellPanel(
                        h4("Live Preview"),
                        uiOutput("cleaning_preview")
                      ),
                      plotlyOutput("freq_shift_chart"),
                      br(),
                      fluidRow(
                        column(6, actionButton("btn_back_p2", "← Back to Input")),
                        column(6, actionButton("btn_next_p3", "Continue to Configuration →", class = "btn-primary", width = "100%"))
                      )
               )
             )
    ),
    
    # -------------------------------------------------------------------------
    # PAGE 3: Sentiment Engine Configuration
    # -------------------------------------------------------------------------
    tabPanel("page3",
             h3("Step 3: Sentiment Engine Configuration"),
             uiOutput("page3_config_summary"),
             fluidRow(
               column(4,
                      wellPanel(
                        h4("1. Sentiment Type"),
                        radioButtons("sentiment_type", NULL,
                                     choices = c("Binary (Positive/Negative)" = "binary",
                                                 "Ternary (Positive/Negative/Neutral)" = "ternary",
                                                 "Emotion-based (8 Categories)" = "emotion"),
                                     selected = character(0))
                      ),
                      wellPanel(
                        h4("2. Method Selection"),
                        uiOutput("method_selector")
                      )
               ),
               column(8,
                      wellPanel(
                        h4("Advanced Options"),
                        checkboxInput("compare_mode", "Enable Model Comparison (All ML Models)", value = FALSE),
                        uiOutput("granularity_slider_ui")
                      ),
                      uiOutput("page3_run_btn"),
                      br(),
                      actionButton("btn_back_p3", "← Back to Cleaning")
               )
             )
    ),
    
    # -------------------------------------------------------------------------
    # PAGE 4: Results & Insight Dashboard
    # -------------------------------------------------------------------------
    tabPanel("page4",
             h3("Step 4: Results & Insight Dashboard"),
             uiOutput("page4_config_summary"),
             hr(),
             uiOutput("page4_insights"),
             hr(),
             fluidRow(
               column(6, plotlyOutput("chart_pie_dist")),
               column(6, uiOutput("chart_conditional_1"))
             ),
             br(),
             fluidRow(
               column(6, uiOutput("chart_conditional_2")),
               column(6, uiOutput("chart_conditional_3"))
             ),
             hr(),
             h4("Classified Results Sample"),
             tableOutput("results_table"),
             downloadButton("download_results", "Download Full Predictions (CSV)", class = "btn-primary"),
             br(), br(),
             actionButton("btn_back_p4", "← Back to Configuration")
    )
  )
)

# =============================================================================
# SERVER LOGIC
# =============================================================================

server <- function(input, output, session) {
  
  # Reactive values for state management
  rv <- reactiveValues(
    input_data = NULL,       # From process_input()
    cleaning_res = NULL,     # From run_cleaning_pipeline()
    analysis_res = NULL      # From run_analysis()
  )
  
  # --- Navigation Handlers ---
  observeEvent(input$btn_next_p2, { updateTabsetPanel(session, "main_tabs", selected = "page2") })
  observeEvent(input$btn_back_p2, { updateTabsetPanel(session, "main_tabs", selected = "page1") })
  observeEvent(input$btn_next_p3, { updateTabsetPanel(session, "main_tabs", selected = "page3") })
  observeEvent(input$btn_back_p3, { updateTabsetPanel(session, "main_tabs", selected = "page2") })
  observeEvent(input$btn_back_p4, { updateTabsetPanel(session, "main_tabs", selected = "page3") })
  
  # =========================================================================
  # PAGE 1 LOGIC
  # =========================================================================
  observeEvent(input$btn_load_data, {
    req(input$input_source)
    
    tryCatch({
      if (input$input_source == "csv") {
        req(input$file_upload)
        res <- process_input(source = "csv", filepath = input$file_upload$datapath)
      } else {
        req(input$text_paste)
        res <- process_input(source = "paste", raw_text = input$text_paste)
      }
      rv$input_data <- res
    }, error = function(e) {
      showNotification(paste("Error:", e$message), type = "error")
    })
  })
  
  output$page1_results <- renderUI({
    req(rv$input_data)
    d <- rv$input_data
    
    tagList(
      if (d$text_detection$confidence == "high") {
        div(class = "alert alert-success", paste("Text column auto-detected:", d$text_column))
      } else {
        div(class = "alert alert-warning", paste("Text column selected:", d$text_column))
      },
      
      fluidRow(
        column(3, div(class = "kpi-card", div(class = "kpi-title", "Total Records"), div(class = "kpi-value", d$kpis$total_records))),
        column(3, div(class = "kpi-card", div(class = "kpi-title", "Avg Words"), div(class = "kpi-value", d$kpis$avg_word_count))),
        column(3, div(class = "kpi-card", div(class = "kpi-title", "Missing"), div(class = "kpi-value", style = if(d$kpis$missing_values>0) "color:red;" else "", d$kpis$missing_values))),
        column(3, div(class = "kpi-card", div(class = "kpi-title", "Language"), div(class = "kpi-value", d$kpis$language)))
      ),
      
      h4("Data Preview (First 10 rows)"),
      renderTable(d$preview_table),
      
      if (!d$label_info$has_labels) {
        div(class = "alert alert-info", "No label column detected. Machine Learning methods will be disabled.")
      } else {
        div(class = "alert alert-info", paste("Label column detected:", d$label_info$column, "- Levels:", paste(d$label_info$levels, collapse=", ")))
      }
    )
  })
  
  output$page1_nav <- renderUI({
    req(rv$input_data)
    actionButton("btn_next_p2", "Continue to Cleaning →", class = "btn-primary", width = "100%", style="margin-top: 20px;")
  })
  
  # =========================================================================
  # PAGE 2 LOGIC
  # =========================================================================
  observe({
    req(rv$input_data)
    rv$cleaning_res <- run_cleaning_pipeline(
      raw_texts  = rv$input_data$texts,
      do_lower   = input$clean_lower,
      do_punct   = input$clean_punct,
      do_numbers = input$clean_numbers,
      do_urls    = input$clean_urls,
      do_stops   = input$clean_stops,
      do_stem    = input$clean_stem
    )
  })
  
  output$cleaning_metrics <- renderUI({
    req(rv$cleaning_res)
    m <- rv$cleaning_res$metrics
    tagList(
      p(strong("Before: "), m$tokens_before, " words"),
      p(strong("After: "), m$tokens_after, " words"),
      p(strong("Reduction: "), paste0(m$pct_reduction, "%"))
    )
  })
  
  output$cleaning_preview <- renderUI({
    req(rv$cleaning_res)
    p <- rv$cleaning_res$preview
    tagList(
      div(style = "background-color: #fdeaea; padding: 10px; margin-bottom: 10px; border-left: 4px solid #e74c3c;", p$original),
      div(style = "background-color: #eafaf1; padding: 10px; border-left: 4px solid #2ecc71;", p$cleaned)
    )
  })
  
  output$freq_shift_chart <- renderPlotly({
    req(rv$cleaning_res)
    df <- rv$cleaning_res$freq_shift
    if(nrow(df) == 0) return(plotly_empty())
    
    plot_ly(df, x = ~raw_count, y = ~reorder(word, raw_count), type = 'bar', orientation = 'h',
            color = ~status, colors = c("removed" = "#3498DB", "retained" = "#2ECC71")) %>%
      layout(title = "Word Frequency Shift", barmode = 'stack',
             xaxis = list(title = "Original Count"), yaxis = list(title = ""))
  })
  
  # =========================================================================
  # PAGE 3 LOGIC
  # =========================================================================
  
  # Dynamic Method Selector based on Availability
  output$method_selector <- renderUI({
    req(rv$input_data)
    # Re-evaluate when sentiment type or compare mode changes
    st <- if (is.null(input$sentiment_type)) "binary" else input$sentiment_type
    avail <- get_method_availability(st, rv$input_data$label_info$has_labels, input$compare_mode)
    
    if (input$compare_mode) {
      return(p(em("Compare mode enabled. All ML models will run automatically.")))
    }
    
    choices <- list()
    for (m in VALID_METHODS) {
      choices[[METHOD_LABELS[[m]]]] <- m
    }
    
    radioButtons("method", NULL, choices = choices, selected = character(0))
  })
  
  # Dynamic Granularity Slider
  output$granularity_slider_ui <- renderUI({
    st <- if (is.null(input$sentiment_type)) "" else input$sentiment_type
    m  <- if (is.null(input$method)) "" else input$method
    
    if (should_show_granularity(st, m, input$compare_mode)) {
      tagList(
        sliderInput("granularity", "Neutral Granularity", min = 0, max = 5, value = 1, step = 0.5),
        p(style = "font-size: 12px; color: #6c757d;", describe_granularity(input$granularity))
      )
    }
  })
  
  # Config Summary Strip
  output$page3_config_summary <- renderUI({
    st <- input$sentiment_type
    m  <- input$method
    show_g <- should_show_granularity(if(is.null(st))"" else st, if(is.null(m))"" else m, input$compare_mode)
    badges <- build_config_summary(st, m, input$compare_mode, input$granularity, show_g)
    
    if (nrow(badges) == 0) return(NULL)
    
    badge_tags <- lapply(1:nrow(badges), function(i) {
      span(class = paste0("badge badge-", badges$type[i]), badges$label[i])
    })
    div(style = "margin-bottom: 20px;", do.call(tagList, badge_tags))
  })
  
  # Run Button Logic
  output$page3_run_btn <- renderUI({
    req(rv$input_data)
    st <- input$sentiment_type
    m  <- input$method
    gate <- check_run_ready(st, m, rv$input_data$label_info$has_labels, input$compare_mode)
    
    tagList(
      if (gate$enabled) {
        actionButton("btn_run_analysis", "Run Analysis", class = "btn-primary", width = "100%")
      } else {
        # Render a disabled button using shinyjs or just shiny HTML wrapper
        tags$button(id = "btn_run_analysis_disabled", type = "button", class = "btn btn-primary action-button", 
                    disabled = "disabled", style = "width: 100%;", "Run Analysis")
      },
      p(style = "margin-top: 10px; color: #6c757d; font-size: 13px;", gate$hint)
    )
  })
  
  # Execute Analysis
  observeEvent(input$btn_run_analysis, {
    req(rv$input_data, rv$cleaning_res)
    
    # Show loading modal
    showModal(modalDialog("Running analysis... Please wait.", footer=NULL))
    
    tryCatch({
      config <- resolve_config(
        sentiment_type    = input$sentiment_type,
        method            = input$method,
        has_labels        = rv$input_data$label_info$has_labels,
        compare_mode      = input$compare_mode,
        granularity_value = input$granularity
      )
      
      labels <- if (rv$input_data$label_info$has_labels) rv$input_data$df[[rv$input_data$label_info$column]] else NULL
      
      rv$analysis_res <- run_analysis(rv$cleaning_res$cleaned_texts, labels, config)
      
      removeModal()
      updateTabsetPanel(session, "main_tabs", selected = "page4")
      
    }, error = function(e) {
      removeModal()
      showNotification(paste("Analysis Error:", e$message), type = "error", duration = 10)
    })
  })
  
  # =========================================================================
  # PAGE 4 LOGIC
  # =========================================================================
  
  output$page4_config_summary <- renderUI({
    req(rv$analysis_res)
    badges <- rv$analysis_res$config$config_summary
    if (nrow(badges) == 0) return(NULL)
    badge_tags <- lapply(1:nrow(badges), function(i) {
      span(class = paste0("badge badge-", badges$type[i]), badges$label[i])
    })
    div(style = "margin-bottom: 20px;", do.call(tagList, badge_tags))
  })
  
  output$page4_insights <- renderUI({
    req(rv$analysis_res)
    shiny::markdown(generate_insights(rv$analysis_res))
  })
  
  output$chart_pie_dist <- renderPlotly({
    req(rv$analysis_res)
    plot_label_distribution(rv$analysis_res)
  })
  
  # Conditional Charts Routing
  output$chart_conditional_1 <- renderUI({
    req(rv$analysis_res)
    cfg <- rv$analysis_res$config
    
    if (cfg$compare_mode) {
      plotlyOutput("chart_compare")
    } else if (cfg$is_lexicon) {
      if (cfg$method == "nrc") plotlyOutput("chart_nrc_radar")
      else plotlyOutput("chart_top_pos")
    } else {
      plotlyOutput("chart_confusion")
    }
  })
  
  output$chart_conditional_2 <- renderUI({
    req(rv$analysis_res)
    cfg <- rv$analysis_res$config
    
    if (cfg$is_lexicon) {
      if (cfg$method == "afinn") plotlyOutput("chart_afinn_hist")
      else if (cfg$method == "nrc") plotlyOutput("chart_nrc_bar")
      else plotlyOutput("chart_top_neg") # Bing
    }
  })
  
  output$chart_conditional_3 <- renderUI({
    req(rv$analysis_res)
    cfg <- rv$analysis_res$config
    
    if (cfg$is_lexicon && cfg$method == "afinn") {
      plotlyOutput("chart_top_neg")
    }
  })
  
  # Render the actual plotly objects
  output$chart_top_pos <- renderPlotly({ plot_top_words(rv$analysis_res, "positive") })
  output$chart_top_neg <- renderPlotly({ plot_top_words(rv$analysis_res, "negative") })
  output$chart_afinn_hist <- renderPlotly({ plot_afinn_histogram(rv$analysis_res) })
  output$chart_nrc_radar <- renderPlotly({ plot_nrc_charts(rv$analysis_res, "radar") })
  output$chart_nrc_bar <- renderPlotly({ plot_nrc_charts(rv$analysis_res, "bar") })
  output$chart_confusion <- renderPlotly({ plot_confusion_matrix(rv$analysis_res) })
  output$chart_compare <- renderPlotly({ plot_compare_chart(rv$analysis_res) })
  
  # Results Table
  output$results_table <- renderTable({
    req(rv$analysis_res)
    if (rv$analysis_res$config$compare_mode) {
      best_m <- rv$analysis_res$best_metrics$f1$model
      preds <- rv$analysis_res$models[[best_m]]$test_predictions
    } else if (rv$analysis_res$is_lexicon) {
      preds <- rv$analysis_res$scored_docs %>% select(doc_id, label) %>% rename(predicted = label)
    } else {
      preds <- rv$analysis_res$test_predictions
    }
    
    # Merge with original texts for preview
    original_texts <- rv$input_data$texts
    
    df_out <- preds %>% 
      head(10) %>%
      mutate(Text = str_trunc(original_texts[doc_id], 100)) %>%
      select(Row = doc_id, Text, Predicted = predicted)
      
    df_out
  })
  
  # Download Handler
  output$download_results <- downloadHandler(
    filename = function() {
      paste("sentiment_predictions_", Sys.Date(), ".csv", sep = "")
    },
    content = function(file) {
      req(rv$analysis_res)
      if (rv$analysis_res$config$compare_mode) {
        best_m <- rv$analysis_res$best_metrics$f1$model
        preds <- rv$analysis_res$models[[best_m]]$test_predictions
      } else if (rv$analysis_res$is_lexicon) {
        preds <- rv$analysis_res$scored_docs %>% rename(predicted = label)
      } else {
        preds <- rv$analysis_res$test_predictions
      }
      
      out_df <- tibble(
        doc_id = preds$doc_id,
        text = rv$input_data$texts[preds$doc_id],
        predicted_sentiment = preds$predicted
      )
      
      write_csv(out_df, file)
    }
  )
}

shinyApp(ui, server)
