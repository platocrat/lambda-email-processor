// src/services/open-ai/index.ts
// Externals
const OpenAI = require('openai')
// Locals
const { MODEL } = require('../lib/constants.js')
const { getConsoleMetadata } = require('../utils.js')
// import { DATA_ANALYSIS_RESULT__OPENAI, EmailAttachment } from '@/types'


// ----------------------- Console metadata constants --------------------------
const LOG_TYPE = 'SERVER'
const FILE_NAME = 'src/services/open-ai/index.ts'

// Initialize OpenAI client
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

/**
 * @dev OpenAI service
 * @note This service is used to analyze data with OpenAI.
 */
class OpenAIService {
  ANALYSIS_PROMPT = `
    Please process all attached files and, using the Python data analysis feature, generate at least 4 visualizations for any structured or semi-structured data they contain. The attachments may include CSV, JSON, or image files with embedded data. For each file:

    * Analyze the data and generate a summary of the data.

    * Detect and parse any structured data. If the file is an image, extract data using OCR and interpret it similarly.

    * Identify all relevant data columns and analyze the relationships between them. Visualize metrics across dimensions where appropriate (e.g., Sales over Time, Products Sold by Region, Customer Retention vs. Acquisition, etc.).

    * Generate at least 4 meaningful charts such as bar charts, line graphs, scatter plots, pie charts, time-series plots for date-based fields, and categorical comparisons for labeled data, based on the nature of the data. Make sure that you use at least 4 identifiers per chart to include as much data from multiple sources or columns as possible.

    * Where applicable:
      * Plot quantitative metrics over time or by categorical groupings.
      * Compare multiple metrics (e.g., Sales vs. Products Sold, New vs. Repeat Customers, etc.).
      * Highlight trends, outliers, and distributions that offer insight into the dataset's behavior.

    * Each chart should have a clear title, labeled axes, and a legend if needed.

    * Summarize the most important findings for all of the generated charts, noting patterns, significant changes, or insights discovered through the analysis.

    Do not assume any specific schema—analyze each file independently and infer the most relevant comparisons and visual representations based on the data it contains.

    Lastly, for each data visualization you create, use Python's matplotlib or seaborn to generate the chart, save it as a PNG file, and upload it as an image attachment so it is available in your response as a downloadable file. Please be sure to follow the same format; that is, the \`outputs\` property MUST be an array of objects with a \`type\` property of \`image\` (NOT \`log\`) and a \`url\` property of the base64-encoded image data:
    
    * Here is an example of a returned message from a code interpreter call that generated two images and attached them to the \`outputs\` property. Please be sure to follow the same format; that is, the \`outputs\` property MUST be an array of objects with a \`type\` property of \`image\` (NOT \`log\`) and a \`url\` property of the base64-encoded image data:
    \`\`\`json
    {
      "id": "ci_6840919b116481a1b7148c65a066db790ca72d1ea1bce6a8",
      "type": "code_interpreter_call",
      "status": "completed",
      "code": "# 3. Employee Performance Ratings - Bar chart for each employee's scores\n\nemployees = employee_perf_data\n\n# Extracting score categories\ncategories = list(employees[0]['scores'].keys())\n\n# Plotting\nplt.figure(figsize=(10, 6))\nfor employee in employees:\n    scores = list(employee['scores'].values())\n    plt.bar(employee['name'], scores, label=employee['name'])\n\n# Instead of individual bars, creating a grouped bar chart for better comparison\nimport numpy as np\n\nnames = [emp['name'] for emp in employees]\nscores_data = np.array([list(emp['scores'].values()) for emp in employees])\n\nx = np.arange(len(names))\nwidth = 0.15\n\nplt.figure(figsize=(12, 6))\nfor i, category in enumerate(categories):\n    plt.bar(x + i*width, scores_data[:, i], width=width, label=category)\n\nplt.xlabel('Employees')\nplt.ylabel('Scores')\nplt.title('Employee Performance Scores by Category')\nplt.xticks(x + width * (len(categories) - 1) / 2, names, rotation=45)\nplt.legend(title='Categories')\nplt.tight_layout()\n\n# Save the figure\nemployee_scores_image_path = \"/mnt/data/employee_scores.png\"\nplt.savefig(employee_scores_image_path)\nplt.show()",
      "container_id": "cntr_68409172241481919529f4801be8b7f30be2b968ff11339f",
      "outputs": [
        {
          "type": "image",
          "url": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAABlUAAAPuCAYAAACRpZsyAAAAOXRFWHRTb2IiIiIiIikoFJFSIiIiIiIiIiIiIiIhmYVCEiIiIiIiIiIiIiIpKBSRUiIiIiIiIiIiIiIiIZ/h9/pkyslhMgMAAAAABJRU5ErkJggg=="
        },
        {
          "type": "image",
          "url": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAACUsAAAScCAYAAAC4d0zrAAAAOXRFWHRTb2Z0d2FyZQBNYXRwbG90bGliIHZlcnNpb24zLjYuMywgaHR0cHM6Ly9tYXRwbG90bGliLm9yZy/P9b71AAAACXBIWXMAAB7CAAAewgFu0HU+AAEAAElEQVR4nOzdd3gU9drG8TuFdJIQQm+h945SpIuIVKmCHDygAh7bQcADogKigA1EDypiARSQItJBioB06TX0EggQIJACaaS9f+TNnkw2u9="
        }
      ]
    }
    \`\`\`
  `

  /**
   * @dev Analyze the data and generate visualizations with insights
   * @param textBody - The text body to analyze
   * @param attachments - The attachments to analyze
   * @returns The analysis result
   */
  async analyzeData (
    textBody/*: string */,
    attachments/*: EmailAttachment[] */
  )/*: Promise<DATA_ANALYSIS_RESULT__OPENAI> */ {
    try {
      // 1. Upload files to OpenAI
      const uploadedFiles/*: string[] */ = await Promise.all(
        // Generate a list of uploaded file IDs for the attachments
        attachments.map(
          async (attachment/*: EmailAttachment */) => {
            const fileBuffer = Buffer.from(
              attachment.content.replace(/^data:.*?;base64,/, ''),
              'base64'
            )
            const fileBlob = new Blob([fileBuffer], { type: attachment.type })
            const file = new File([fileBlob], attachment.name)
            const purpose = 'assistants'
            // Upload the file to OpenAI
            const uploadedFile = await client.files.create({ file, purpose })
            // Return the uploaded file ID
            return uploadedFile.id
          }
        )
      )

      const consoleMetadata = getConsoleMetadata(
        LOG_TYPE,
        true,
        FILE_NAME,
        'analyzeData()'
      )

      console.log(
        `${ consoleMetadata } uploadedFiles: `,
        uploadedFiles
      )

      // 2. Construct the input for the Responses API
      // First, system (prompt) message:
      const inputArray/*: any[] */ = [
        {
          role: 'system',
          content: [
            {
              type: 'input_text',
              text: this.ANALYSIS_PROMPT
            }
          ]
        },
        {
          role: 'user',
          content: [
            {
              type: 'input_text',
              text: textBody // Or another summary string if desired
            }
          ]
        }
      ]

      // 3. Send the request to the Responses API
      const response = await client.responses.create({
        model: MODEL, // e.g. "gpt-4o", "gpt-4-1106-preview", etc.
        input: inputArray,
        tools: [
          {
            type: 'code_interpreter',
            container: {
              type: 'auto',
              file_ids: uploadedFiles
            }
          }
        ],
        temperature: 1,
        max_output_tokens: 2048,
        top_p: 1,
        store: true // allows you to fetch files after
      })

      console.log(`${ consoleMetadata } response: `, response)

      // 4. Extract results: text and any image files from the outputs
      // const result: DATA_ANALYSIS_RESULT__OPENAI = {
      //   textContent: '',
      //   imageFiles: []
      // }

      //   type ExtractionResult = {
      //     textContent: string
      //     imageFiles: string[]
      //   }

      /**
       * @dev Recursively extracts text content and images from any OpenAI 
       * response structure.
       */
      function extractOpenAIResponse (
        obj/*: any */,
        acc/*: ExtractionResult */ = { textContent: '', imageFiles: [] }
      )/*: ExtractionResult */ {
        if (Array.isArray(obj)) {
          for (const item of obj) {
            extractOpenAIResponse(item, acc)
          }
        } else if (obj && typeof obj === 'object') {
          // Extract text from message/content types
          if (
            (obj.type === 'text' || obj.type === 'output_text') &&
            typeof obj.text === 'string'
          ) {
            acc.textContent += `${ obj.text }\n`
          }
          // Extract images from code interpreter outputs
          if (
            obj.type === 'image' &&
            typeof obj.url === 'string'
          ) {
            acc.imageFiles.push(obj.url)
          }

          // Sometimes, `output_text` can appear at the top level
          if (typeof obj.output_text === 'string') {
            acc.textContent += `${ obj.output_text }\n`
          }

          // Recursively search all properties
          for (const key of Object.keys(obj)) {
            extractOpenAIResponse(obj[key], acc)
          }
        }

        return acc
      }

      // Example usage after your response:
      const result = extractOpenAIResponse(response)

      console.log(
        `${ getConsoleMetadata(
          LOG_TYPE,
          true,
          FILE_NAME,
          'analyzeData()'
        )
        } result: `,
        result
      )

      // // Look for `output_text` content in the top-level response
      // if (response.output_text) {
      //   const consoleMetadata: string = getConsoleMetadata(
      //     LOG_TYPE, 
      //     true,
      //     FILE_NAME, 
      //     'analyzeData()'
      //   )
      //   console.log(
      //     `${consoleMetadata} response.output_text: `, 
      //     response.output_text
      //   )

      //   result.textContent += response.output_text + '\n'
      // }

      // // Iterate through the outputs and extract image files
      // response.output.forEach((output: any, i: number) => {
      //   const consoleMetadata: string = getConsoleMetadata(
      //     LOG_TYPE, 
      //     true,
      //     FILE_NAME, 
      //     'analyzeData()'
      //   )
      //   console.log(`${consoleMetadata} response.output[${i}]: `, output)

      //   if (
      //     output.type === 'code_interpreter_call' &&
      //     output.outputs.length > 0
      //   ) {
      //     // Iterate through the outputs of the code interpreter call
      //     for (const outputItem of output.outputs) {
      //       if (outputItem.type === 'image') {
      //         result.imageFiles.push(outputItem.url)
      //       }
      //     }
      //   } else if (output.type === 'message') {
      //     // Iterate through the content of the message
      //     output.content.forEach((contentItem: any, j: number) => {
      //       const consoleMetadata: string = getConsoleMetadata(
      //         LOG_TYPE, 
      //         true,
      //         FILE_NAME, 
      //         'analyzeData()'
      //       )
      //       console.log(
      //         `${consoleMetadata} response.output[${i}].content[${j}]: `,
      //         contentItem
      //       )
      //     })
      //   }
      // })

      // 5. Clean up: delete uploaded files
      for (const fileId of uploadedFiles) {
        await client.files.delete(fileId)
      }

      return result
    } catch (error) {
      console.error('Error analyzing data with OpenAI:', error)
      throw error
    }
  }
}

/**
 * @dev Export the OpenAIService class as a singleton
 */
const openaiService = new OpenAIService()

module.exports = {
  openaiService
}
