import { useState, useCallback } from 'react'
import { AnalysisResult } from '../types'

interface AnalysisResultViewProps {
  analysis: AnalysisResult
  onContentChange?: (newTitle: string, newContent: string) => void
}

export default function AnalysisResultView({ analysis, onContentChange }: AnalysisResultViewProps) {
  const [editedTitle, setEditedTitle] = useState(analysis.newTitle)
  const [editedContent, setEditedContent] = useState(analysis.newContent)

  const handleTitleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newTitle = e.target.value
    setEditedTitle(newTitle)
    onContentChange?.(newTitle, editedContent)
  }, [editedContent, onContentChange])

  const handleContentChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value
    setEditedContent(newContent)
    onContentChange?.(editedTitle, newContent)
  }, [editedTitle, onContentChange])

  return (
    <div className="space-y-6">
      {/* 文章优点 */}
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
          <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
          文章优点
        </h2>
        <div className="space-y-3">
          {analysis.strengths.length > 0 ? (
            analysis.strengths.map((strength, index) => (
              <div
                key={index}
                className="p-4 bg-green-50 border border-green-200 rounded-lg"
              >
                <h3 className="font-medium text-green-800 mb-1">{strength.title}</h3>
                <p className="text-sm text-green-700">{strength.description}</p>
              </div>
            ))
          ) : (
            <p className="text-gray-500 text-sm">暂无明显优点</p>
          )}
        </div>
      </div>

      {/* 文章缺点与建议 */}
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
          <span className="w-2 h-2 bg-orange-500 rounded-full mr-2"></span>
          文章缺点与改进建议
        </h2>
        <div className="space-y-3">
          {analysis.weaknesses.length > 0 ? (
            analysis.weaknesses.map((weakness, index) => (
              <div
                key={index}
                className="p-4 bg-orange-50 border border-orange-200 rounded-lg"
              >
                <h3 className="font-medium text-orange-800 mb-1">{weakness.title}</h3>
                <p className="text-sm text-orange-700 mb-2">{weakness.description}</p>
                <div className="pt-2 border-t border-orange-200">
                  <span className="text-xs font-medium text-orange-600">改进建议：</span>
                  <p className="text-sm text-orange-700 mt-1">{weakness.suggestion}</p>
                </div>
              </div>
            ))
          ) : (
            <p className="text-gray-500 text-sm">暂无明显缺点</p>
          )}
        </div>
      </div>

      {/* 配图建议 */}
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
          <span className="w-2 h-2 bg-blue-500 rounded-full mr-2"></span>
          配图建议
        </h2>
        <div className="space-y-3">
          {analysis.imageSuggestions.length > 0 ? (
            analysis.imageSuggestions.map((suggestion, index) => (
              <div
                key={index}
                className="p-4 bg-blue-50 border border-blue-200 rounded-lg"
              >
                <div className="flex items-start">
                  <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center mr-3">
                    <span className="text-blue-600 text-sm font-medium">{index + 1}</span>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">
                        {suggestion.position}
                      </span>
                      <span className="px-2 py-0.5 bg-blue-200 text-blue-800 rounded text-xs">
                        {suggestion.type}
                      </span>
                    </div>
                    <p className="text-sm text-blue-700">{suggestion.description}</p>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <p className="text-gray-500 text-sm">暂无配图建议</p>
          )}
        </div>
      </div>

      {/* 关键词 */}
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
          <span className="w-2 h-2 bg-purple-500 rounded-full mr-2"></span>
          关键词
        </h2>
        <div className="flex flex-wrap gap-2">
          {analysis.keywords.map((keyword, index) => (
            <span
              key={index}
              className="px-3 py-1 bg-purple-50 text-purple-700 rounded-full text-sm border border-purple-200"
              style={{
                fontSize: `${Math.max(12, Math.min(16, 12 + keyword.weight * 4))}px`,
                opacity: Math.max(0.7, Math.min(1, 0.7 + keyword.weight * 0.3))
              }}
            >
              {keyword.word}
            </span>
          ))}
        </div>
      </div>

      {/* 内容摘要 */}
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
          <span className="w-2 h-2 bg-gray-500 rounded-full mr-2"></span>
          内容摘要
        </h2>
        <p className="text-gray-700 leading-relaxed">{analysis.summary}</p>
      </div>

      {/* 重写后的文章 */}
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
          <span className="w-2 h-2 bg-wechat-green rounded-full mr-2"></span>
          优化后的文章
          <span className="ml-2 text-xs text-gray-500 font-normal">(可编辑)</span>
        </h2>

        {/* 标题输入 */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">文章标题</label>
          <input
            type="text"
            value={editedTitle}
            onChange={handleTitleChange}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-wechat-green focus:border-transparent transition-all"
            placeholder="输入文章标题"
          />
        </div>

        {/* 内容编辑 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">文章内容</label>
          <textarea
            value={editedContent}
            onChange={handleContentChange}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-wechat-green focus:border-transparent transition-all resize-none"
            rows={20}
            placeholder="输入文章内容"
          />
          <div className="mt-2 flex justify-between text-xs text-gray-500">
            <span>字数：{editedContent.length}</span>
            <span>段落：{editedContent.split('\n\n').filter(p => p.trim()).length}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
