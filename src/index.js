const core = require('@actions/core')
const axios = require('axios')
const FormData = require('form-data')
const fs = require('fs')

async function run() {
  try {
    const token = core.getInput('bearer-token', { required: true })
    const gameId = core.getInput('game-id', { required: true })
    const modId = core.getInput('mod-id', { required: true })
    const filePath = core.getInput('file-path', { required: true })

    const version = core.getInput('version') || ''
    const changelog = core.getInput('changelog') || ''
    const active = core.getInput('active') || '' // pass-through (mod.io accepts “1”/“0” or empty)
    const filehash = core.getInput('filehash') || '' // optional MD5 to compare server-side
    const metadataBlob = core.getInput('metadata_blob') || ''

    // Build form-data
    const form = new FormData()
    form.append('filedata', fs.createReadStream(filePath))
    if (version) form.append('version', version)
    if (changelog) form.append('changelog', changelog)
    if (active) form.append('active', active)
    if (filehash) form.append('filehash', filehash)
    if (metadataBlob) form.append('metadata_blob', metadataBlob)

    const url = `https://api.mod.io/v1/games/${encodeURIComponent(gameId)}/mods/${encodeURIComponent(modId)}/files`

    const res = await axios.request({
      method: 'post',
      url,
      maxBodyLength: Infinity,
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
        ...form.getHeaders() // includes proper multipart boundary
      },
      data: form,
      validateStatus: () => true // let us handle non-2xx as failures
    })

    if (res.status >= 200 && res.status < 300) {
      core.info(`Upload succeeded (status ${res.status}).`)
      core.setOutput('response', JSON.stringify(res.data))
      // Optional: expose uploaded file id
      if (res.data && res.data.id)
        core.setOutput('file-id', String(res.data.id))
    } else {
      const body =
        typeof res.data === 'object'
          ? JSON.stringify(res.data, null, 2)
          : String(res.data)
      core.setFailed(`Upload failed with status ${res.status}:\n${body}`)
    }
  } catch (err) {
    // Prefer server response body if present
    if (err.response) {
      const body =
        typeof err.response.data === 'object'
          ? JSON.stringify(err.response.data, null, 2)
          : String(err.response.data)
      core.setFailed(`Request error (${err.response.status}):\n${body}`)
    } else {
      core.setFailed(`Error: ${err.message}`)
    }
  }
}

run()
