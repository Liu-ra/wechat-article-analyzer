import axios from 'axios'
import { logger } from './logger'

// DeepSeek API 配置
const DEEPSEEK_API_KEY = 'sk-d2f2f88b7ecb433c811a90cea5f02edb'
const DEEPSEEK_BASE_URL = 'https://api.deepseek.com/v1'

interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface DeepSeekResponse {
  id: string
  object: string
  created: number
  model: string
  choices: {
    index: number
    message: {
      role: string
      content: string
    }
    finish_reason: string
  }[]
  usage: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
}

/**
 * 调用 DeepSeek API 进行对话
 */
export async function chatWithDeepSeek(
  messages: ChatMessage[],
  options: {
    model?: string
    temperature?: number
    max_tokens?: number
  } = {}
): Promise<string> {
  const {
    model = 'deepseek-chat',
    temperature = 0.7,
    max_tokens = 4096
  } = options

  try {
    logger.info('调用 DeepSeek API', {
      model,
      messageCount: messages.length,
      lastMessageLength: messages[messages.length - 1]?.content.length
    })

    const response = await axios.post<DeepSeekResponse>(
      `${DEEPSEEK_BASE_URL}/chat/completions`,
      {
        model,
        messages,
        temperature,
        max_tokens,
        stream: false
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
        },
        timeout: 120000 // 2分钟超时
      }
    )

    const content = response.data.choices[0]?.message?.content || ''

    logger.info('DeepSeek API 响应成功', {
      model,
      promptTokens: response.data.usage?.prompt_tokens,
      completionTokens: response.data.usage?.completion_tokens
    })

    return content
  } catch (error) {
    if (axios.isAxiosError(error)) {
      logger.error('DeepSeek API 请求失败', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data
      })

      if (error.response?.status === 401) {
        throw new Error('DeepSeek API Key 无效')
      }
      if (error.response?.status === 429) {
        throw new Error('DeepSeek API 请求频率过高，请稍后重试')
      }
      if (error.response?.status === 500) {
        throw new Error('DeepSeek 服务器错误，请稍后重试')
      }
    }

    logger.error('DeepSeek API 调用失败', {
      error: error instanceof Error ? error.message : String(error)
    })
    throw error
  }
}

/**
 * 分析文章内容
 */
export async function analyzeArticleWithAI(
  content: string,
  title?: string,
  onThinking?: (thinking: string) => void
): Promise<{
  strengths: { title: string; description: string }[]
  weaknesses: { title: string; description: string; suggestion: string }[]
  imageSuggestions: { position: string; type: string; description: string }[]
  newTitle: string
  newContent: string
  summary: string
}> {
  const systemPrompt = `你是一位专业的微信公众号文章分析专家和编辑。你的任务是分析用户提供的文章，并给出专业的分析报告。

请严格按照以下 JSON 格式返回分析结果（不要包含任何其他文字，只返回JSON）：

{
  "strengths": [
    {"title": "优点标题", "description": "具体描述"}
  ],
  "weaknesses": [
    {"title": "缺点标题", "description": "具体描述", "suggestion": "改进建议"}
  ],
  "imageSuggestions": [
    {"position": "建议配图位置", "type": "图片类型", "description": "图片内容描述"}
  ],
  "newTitle": "优化后的标题",
  "newContent": "重写优化后的完整文章内容",
  "summary": "文章摘要（100-200字）"
}

分析要求：
1. strengths（优点）：分析文章的3-5个优点，如结构、内容深度、数据支撑、表达方式等
2. weaknesses（缺点）：分析文章的2-4个不足之处，并给出具体可行的改进建议
3. imageSuggestions（配图建议）：给出3-5个配图建议，说明在什么位置配什么类型的图
4. newTitle：基于原标题优化，更吸引人，可以使用数字、疑问句等技巧
5. newContent：重写文章，保留核心内容，优化结构和表达，添加小标题，控制段落长度
6. summary：提炼文章核心内容的摘要`

  const userPrompt = title
    ? `请分析以下文章：\n\n标题：${title}\n\n正文：\n${content}`
    : `请分析以下文章：\n\n${content}`

  const response = await chatWithDeepSeek([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt }
  ], {
    temperature: 0.7,
    max_tokens: 8192
  })

  // 解析 JSON 响应
  try {
    // 尝试提取 JSON（处理可能的 markdown 代码块）
    let jsonStr = response
    const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim()
    }

    const result = JSON.parse(jsonStr)

    // 验证必要字段
    if (!result.strengths || !result.weaknesses || !result.newTitle || !result.newContent) {
      throw new Error('AI 响应缺少必要字段')
    }

    return {
      strengths: result.strengths || [],
      weaknesses: result.weaknesses || [],
      imageSuggestions: result.imageSuggestions || [],
      newTitle: result.newTitle || title || '未命名文章',
      newContent: result.newContent || content,
      summary: result.summary || ''
    }
  } catch (parseError) {
    logger.error('解析 AI 响应失败', {
      error: parseError instanceof Error ? parseError.message : String(parseError),
      response: response.substring(0, 500)
    })
    throw new Error('AI 分析结果解析失败，请重试')
  }
}
