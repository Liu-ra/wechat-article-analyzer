import { useState, useEffect } from 'react'
import { ArticleStats } from '../types'

interface StatsInputProps {
  stats: ArticleStats | null
  onUpdate: (stats: ArticleStats) => void
}

export default function StatsInput({ stats, onUpdate }: StatsInputProps) {
  const [localStats, setLocalStats] = useState<ArticleStats>({
    readCount: stats?.readCount ?? null,
    likeCount: stats?.likeCount ?? null,
    wowCount: stats?.wowCount ?? null,
    shareCount: stats?.shareCount ?? null,
    favoriteCount: stats?.favoriteCount ?? null,
    commentCount: stats?.commentCount ?? null,
    isManualInput: stats?.isManualInput ?? false
  })

  const [showManualInput, setShowManualInput] = useState(
    stats?.isManualInput || stats?.readCount === null
  )

  useEffect(() => {
    onUpdate(localStats)
  }, [localStats, onUpdate])

  const handleInputChange = (field: keyof ArticleStats, value: string) => {
    const numValue = value === '' ? null : parseInt(value, 10)
    setLocalStats(prev => ({
      ...prev,
      [field]: isNaN(numValue as number) ? null : numValue,
      isManualInput: true
    }))
  }

  const formatNumber = (num: number | null): string => {
    if (num === null) return '-'
    if (num >= 100000) return `${(num / 10000).toFixed(1)}万`
    return num.toLocaleString()
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-800">数据统计</h2>
        {!showManualInput && stats?.readCount !== null && (
          <span className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded">
            自动获取成功
          </span>
        )}
      </div>

      {/* 自动获取的数据展示 */}
      {!showManualInput && stats?.readCount !== null ? (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <p className="text-2xl font-bold text-wechat-green">
                {formatNumber(localStats.readCount)}
              </p>
              <p className="text-sm text-gray-500 mt-1">阅读量</p>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <p className="text-2xl font-bold text-blue-500">
                {formatNumber(localStats.likeCount)}
              </p>
              <p className="text-sm text-gray-500 mt-1">点赞数</p>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <p className="text-2xl font-bold text-orange-500">
                {formatNumber(localStats.wowCount)}
              </p>
              <p className="text-sm text-gray-500 mt-1">在看数</p>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <p className="text-2xl font-bold text-purple-500">
                {formatNumber(localStats.shareCount)}
              </p>
              <p className="text-sm text-gray-500 mt-1">转发数</p>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <p className="text-2xl font-bold text-pink-500">
                {formatNumber(localStats.favoriteCount)}
              </p>
              <p className="text-sm text-gray-500 mt-1">收藏数</p>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <p className="text-2xl font-bold text-indigo-500">
                {formatNumber(localStats.commentCount)}
              </p>
              <p className="text-sm text-gray-500 mt-1">评论数</p>
            </div>
          </div>

          <button
            onClick={() => setShowManualInput(true)}
            className="text-sm text-gray-500 hover:text-gray-700 underline"
          >
            手动修改数据
          </button>
        </div>
      ) : (
        /* 手动输入表单 */
        <div className="space-y-4">
          <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
            未能自动获取数据统计，请手动输入（可选）
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                阅读量
              </label>
              <input
                type="number"
                min="0"
                value={localStats.readCount ?? ''}
                onChange={(e) => handleInputChange('readCount', e.target.value)}
                placeholder="输入阅读量"
                className="input-field"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                点赞数
              </label>
              <input
                type="number"
                min="0"
                value={localStats.likeCount ?? ''}
                onChange={(e) => handleInputChange('likeCount', e.target.value)}
                placeholder="输入点赞数"
                className="input-field"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                在看数
              </label>
              <input
                type="number"
                min="0"
                value={localStats.wowCount ?? ''}
                onChange={(e) => handleInputChange('wowCount', e.target.value)}
                placeholder="输入在看数"
                className="input-field"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                转发数
              </label>
              <input
                type="number"
                min="0"
                value={localStats.shareCount ?? ''}
                onChange={(e) => handleInputChange('shareCount', e.target.value)}
                placeholder="输入转发数"
                className="input-field"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                收藏数
              </label>
              <input
                type="number"
                min="0"
                value={localStats.favoriteCount ?? ''}
                onChange={(e) => handleInputChange('favoriteCount', e.target.value)}
                placeholder="输入收藏数"
                className="input-field"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                评论数
              </label>
              <input
                type="number"
                min="0"
                value={localStats.commentCount ?? ''}
                onChange={(e) => handleInputChange('commentCount', e.target.value)}
                placeholder="输入评论数"
                className="input-field"
              />
            </div>
          </div>

          {stats?.readCount !== null && (
            <button
              onClick={() => setShowManualInput(false)}
              className="text-sm text-gray-500 hover:text-gray-700 underline"
            >
              使用自动获取的数据
            </button>
          )}
        </div>
      )}
    </div>
  )
}
