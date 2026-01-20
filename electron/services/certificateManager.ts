import forge from 'node-forge'
import fs from 'fs'
import path from 'path'
import { app } from 'electron'
import { exec } from 'child_process'
import { promisify } from 'util'
import { logger } from './logger'

const execAsync = promisify(exec)

const CERT_DIR = path.join(app.getPath('userData'), 'certificates')
const CA_KEY_PATH = path.join(CERT_DIR, 'ca-key.pem')
const CA_CERT_PATH = path.join(CERT_DIR, 'ca-cert.pem')

interface CertificateInfo {
  keyPath: string
  certPath: string
  key: string
  cert: string
}

/**
 * 确保证书目录存在
 */
function ensureCertDir() {
  if (!fs.existsSync(CERT_DIR)) {
    fs.mkdirSync(CERT_DIR, { recursive: true })
    logger.info('创建证书目录', { path: CERT_DIR })
  }
}

/**
 * 生成CA根证书
 */
export function generateCACertificate(): CertificateInfo {
  ensureCertDir()

  logger.info('开始生成CA根证书')

  // 检查是否已存在证书
  if (fs.existsSync(CA_KEY_PATH) && fs.existsSync(CA_CERT_PATH)) {
    logger.info('使用已存在的CA证书')
    return {
      keyPath: CA_KEY_PATH,
      certPath: CA_CERT_PATH,
      key: fs.readFileSync(CA_KEY_PATH, 'utf-8'),
      cert: fs.readFileSync(CA_CERT_PATH, 'utf-8')
    }
  }

  // 生成密钥对
  const keys = forge.pki.rsa.generateKeyPair(2048)

  // 创建证书
  const cert = forge.pki.createCertificate()
  cert.publicKey = keys.publicKey
  cert.serialNumber = '01'
  cert.validity.notBefore = new Date()
  cert.validity.notAfter = new Date()
  cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 10)

  const attrs = [
    {
      name: 'commonName',
      value: 'WeChat Article Analyzer CA'
    },
    {
      name: 'countryName',
      value: 'CN'
    },
    {
      shortName: 'ST',
      value: 'Beijing'
    },
    {
      name: 'localityName',
      value: 'Beijing'
    },
    {
      name: 'organizationName',
      value: 'WeChat Article Analyzer'
    },
    {
      shortName: 'OU',
      value: 'Certificate Authority'
    }
  ]

  cert.setSubject(attrs)
  cert.setIssuer(attrs)

  cert.setExtensions([
    {
      name: 'basicConstraints',
      cA: true
    },
    {
      name: 'keyUsage',
      keyCertSign: true,
      digitalSignature: true,
      nonRepudiation: true,
      keyEncipherment: true,
      dataEncipherment: true
    },
    {
      name: 'subjectKeyIdentifier'
    }
  ])

  // 自签名
  cert.sign(keys.privateKey, forge.md.sha256.create())

  // 转换为PEM格式
  const keyPem = forge.pki.privateKeyToPem(keys.privateKey)
  const certPem = forge.pki.certificateToPem(cert)

  // 保存到文件
  fs.writeFileSync(CA_KEY_PATH, keyPem)
  fs.writeFileSync(CA_CERT_PATH, certPem)

  logger.info('CA根证书生成成功', {
    keyPath: CA_KEY_PATH,
    certPath: CA_CERT_PATH
  })

  return {
    keyPath: CA_KEY_PATH,
    certPath: CA_CERT_PATH,
    key: keyPem,
    cert: certPem
  }
}

/**
 * 为域名生成服务器证书
 */
export function generateServerCertificate(hostname: string, caCert: string, caKey: string): { cert: string; key: string } {
  logger.debug('为域名生成服务器证书', { hostname })

  // 解析CA证书和密钥
  const caKeyObj = forge.pki.privateKeyFromPem(caKey)
  const caCertObj = forge.pki.certificateFromPem(caCert)

  // 生成服务器密钥对
  const keys = forge.pki.rsa.generateKeyPair(2048)

  // 创建服务器证书
  const cert = forge.pki.createCertificate()
  cert.publicKey = keys.publicKey
  cert.serialNumber = Date.now().toString(16)
  cert.validity.notBefore = new Date()
  cert.validity.notAfter = new Date()
  cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 1)

  const attrs = [
    {
      name: 'commonName',
      value: hostname
    },
    {
      name: 'countryName',
      value: 'CN'
    },
    {
      name: 'organizationName',
      value: 'WeChat Article Analyzer'
    }
  ]

  cert.setSubject(attrs)
  cert.setIssuer(caCertObj.subject.attributes)

  cert.setExtensions([
    {
      name: 'basicConstraints',
      cA: false
    },
    {
      name: 'keyUsage',
      digitalSignature: true,
      keyEncipherment: true
    },
    {
      name: 'extKeyUsage',
      serverAuth: true
    },
    {
      name: 'subjectAltName',
      altNames: [
        {
          type: 2, // DNS
          value: hostname
        },
        {
          type: 2,
          value: `*.${hostname}`
        }
      ]
    }
  ])

  // 使用CA密钥签名
  cert.sign(caKeyObj, forge.md.sha256.create())

  const keyPem = forge.pki.privateKeyToPem(keys.privateKey)
  const certPem = forge.pki.certificateToPem(cert)

  return {
    cert: certPem,
    key: keyPem
  }
}

/**
 * 安装CA证书到系统信任存储（Windows）
 */
export async function installCACertificateToSystem(certPath: string): Promise<boolean> {
  try {
    logger.info('开始安装CA证书到系统信任存储')

    // Windows: 使用certutil命令安装到"受信任的根证书颁发机构"
    const command = `certutil -addstore "Root" "${certPath}"`

    await execAsync(command)

    logger.info('CA证书安装成功')
    return true
  } catch (error) {
    logger.error('安装CA证书失败', {
      error: error instanceof Error ? error.message : String(error)
    })
    return false
  }
}

/**
 * 从系统信任存储卸载CA证书（Windows）
 */
export async function uninstallCACertificateFromSystem(): Promise<boolean> {
  try {
    logger.info('开始从系统卸载CA证书')

    // 读取证书以获取序列号
    const certPem = fs.readFileSync(CA_CERT_PATH, 'utf-8')
    const cert = forge.pki.certificateFromPem(certPem)
    const serialNumber = cert.serialNumber

    // Windows: 使用certutil命令删除
    const command = `certutil -delstore "Root" "${serialNumber}"`

    await execAsync(command)

    logger.info('CA证书卸载成功')
    return true
  } catch (error) {
    logger.error('卸载CA证书失败', {
      error: error instanceof Error ? error.message : String(error)
    })
    return false
  }
}

/**
 * 检查CA证书是否已安装到系统
 */
export async function isCACertificateInstalled(): Promise<boolean> {
  try {
    if (!fs.existsSync(CA_CERT_PATH)) {
      return false
    }

    // 读取证书
    const certPem = fs.readFileSync(CA_CERT_PATH, 'utf-8')
    const cert = forge.pki.certificateFromPem(certPem)
    const commonName = cert.subject.getField('CN').value

    // Windows: 检查是否在受信任的根证书颁发机构中
    const command = `certutil -store "Root" | findstr /C:"${commonName}"`

    await execAsync(command)

    return true
  } catch (error) {
    return false
  }
}
