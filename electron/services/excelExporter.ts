import ExcelJS from 'exceljs'
import { app, dialog } from 'electron'
import path from 'path'
import fs from 'fs'
import { logger } from './logger'
import { ArticleFullData } from './batchAnalyzer'

/**
 * 导出文章数据到Excel
 */
export async function exportToExcel(
  articles: ArticleFullData[],
  accountName: string
): Promise<string> {
  try {
    logger.info('开始生成Excel', { count: articles.length, accountName })

    // 创建工作簿
    const workbook = new ExcelJS.Workbook()
    workbook.creator = '微信公众号文章分析工具'
    workbook.created = new Date()

    // 创建工作表
    const worksheet = workbook.addWorksheet('文章数据')

    // 设置列
    worksheet.columns = [
      { header: '序号', key: 'index', width: 8 },
      { header: '标题', key: 'title', width: 40 },
      { header: '作者', key: 'author', width: 15 },
      { header: '发布时间', key: 'publishTime', width: 20 },
      { header: '阅读量', key: 'readCount', width: 12 },
      { header: '点赞数', key: 'likeCount', width: 12 },
      { header: '在看数', key: 'wowCount', width: 12 },
      { header: '分享数', key: 'shareCount', width: 12 },
      { header: '收藏数', key: 'favoriteCount', width: 12 },
      { header: '评论数', key: 'commentCount', width: 12 },
      { header: '字数', key: 'wordCount', width: 12 },
      { header: '摘要', key: 'digest', width: 50 },
      { header: '文章链接', key: 'url', width: 60 }
    ]

    // 设置表头样式
    worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4472C4' }
    }
    worksheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' }
    worksheet.getRow(1).height = 25

    // 添加数据行
    articles.forEach((article, index) => {
      const row = worksheet.addRow({
        index: index + 1,
        title: article.title,
        author: article.author,
        publishTime: article.publishTime,
        readCount: article.readCount ?? '-',
        likeCount: article.likeCount ?? '-',
        wowCount: article.wowCount ?? '-',
        shareCount: article.shareCount ?? '-',
        favoriteCount: article.favoriteCount ?? '-',
        commentCount: article.commentCount ?? '-',
        wordCount: article.wordCount,
        digest: article.digest,
        url: article.url
      })

      // 设置行样式
      row.alignment = { vertical: 'middle', wrapText: true }
      row.height = 30

      // 隔行变色
      if (index % 2 === 1) {
        row.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF2F2F2' }
        }
      }

      // 链接样式
      const urlCell = row.getCell('url')
      urlCell.font = { color: { argb: 'FF0563C1' }, underline: true }
      urlCell.value = {
        text: article.url,
        hyperlink: article.url
      }
    })

    // 冻结首行
    worksheet.views = [{ state: 'frozen', ySplit: 1 }]

    // 添加汇总信息
    const summaryRow = worksheet.addRow({})
    summaryRow.getCell('title').value = '数据汇总'
    summaryRow.getCell('title').font = { bold: true }

    const totalRow = worksheet.addRow({
      index: '',
      title: '文章总数',
      author: articles.length,
      publishTime: '',
      readCount: articles.reduce((sum, a) => sum + (a.readCount || 0), 0),
      likeCount: articles.reduce((sum, a) => sum + (a.likeCount || 0), 0),
      wowCount: articles.reduce((sum, a) => sum + (a.wowCount || 0), 0),
      shareCount: articles.reduce((sum, a) => sum + (a.shareCount || 0), 0),
      favoriteCount: articles.reduce((sum, a) => sum + (a.favoriteCount || 0), 0),
      commentCount: articles.reduce((sum, a) => sum + (a.commentCount || 0), 0),
      wordCount: articles.reduce((sum, a) => sum + a.wordCount, 0)
    })

    totalRow.font = { bold: true }
    totalRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFDE9D9' }
    }

    // 生成文件名
    const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0]
    const fileName = `${accountName}_文章数据_${timestamp}.xlsx`

    // 临时保存到用户数据目录
    const userDataPath = app.getPath('userData')
    const tempFilePath = path.join(userDataPath, fileName)

    // 写入文件
    await workbook.xlsx.writeFile(tempFilePath)

    logger.info('✓ Excel生成成功', { path: tempFilePath, rows: articles.length })

    return tempFilePath
  } catch (error) {
    logger.error('Excel生成失败', {
      error: error instanceof Error ? error.message : error
    })
    throw error
  }
}

/**
 * 保存Excel文件（弹出保存对话框）
 */
export async function saveExcelFile(
  tempFilePath: string,
  defaultFileName: string
): Promise<string | null> {
  try {
    const result = await dialog.showSaveDialog({
      title: '保存Excel文件',
      defaultPath: defaultFileName,
      filters: [{ name: 'Excel文件', extensions: ['xlsx'] }]
    })

    if (result.canceled || !result.filePath) {
      return null
    }

    // 复制临时文件到目标位置
    fs.copyFileSync(tempFilePath, result.filePath)

    // 删除临时文件
    fs.unlinkSync(tempFilePath)

    logger.info('✓ Excel文件保存成功', { path: result.filePath })

    return result.filePath
  } catch (error) {
    logger.error('Excel文件保存失败', {
      error: error instanceof Error ? error.message : error
    })
    throw error
  }
}
