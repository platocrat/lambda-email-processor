/**
 * @dev Function to get the current UTC timestamp in nanoseconds
 * @returns {BigInt} The current UTC timestamp in nanoseconds
 */
function nowInNs () {
  const timeOrigin = BigInt(Math.round(performance.timeOrigin * 1_000_000))
  const now = BigInt(Math.round(performance.now() * 1_000_000))
  return timeOrigin + now
}


/**
 * @dev Function to get the console metadata for logging.
 * @param {string} logType - The type of log.
 * @param {boolean} isLog - Whether the log is a log or an error.
 * @param {string} filePath - The file path of the log.
 * @param {string} functionName - The name of the function that logged the message.
 */
function getConsoleMetadata (
  logType,
  isLog,
  filePath,
  functionName,
) {
  const currentTime = nowInNs()

  return `[${ logType
    } ${ isLog ? 'LOG' : 'ERROR'
    }: --logTimestamp="${ currentTime
    }" --file-path="${ filePath
    } --function-name="${ functionName
    }"]: `
}

module.exports = {
  getConsoleMetadata,
}