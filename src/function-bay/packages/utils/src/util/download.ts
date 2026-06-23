import * as fs from 'fs';
import * as http from 'http';
import * as https from 'https';
import { URL } from 'url';

export let download = (url: string, dest: string) => {
  return new Promise<void>((resolve, reject) => {
    console.log(`Downloading ${url}`);

    let parsedUrl = new URL(url);
    let protocol = parsedUrl.protocol === 'https:' ? https : http;

    let file = fs.createWriteStream(dest);
    let downloadedBytes = 0;
    let totalBytes = 0;
    let startTime = Date.now();
    let lastLogTime = Date.now();
    let lastDownloadedBytes = 0;

    let request = protocol.get(url, response => {
      // Handle redirects
      if (response.statusCode === 301 || response.statusCode === 302) {
        let redirectUrl = response.headers.location;
        if (redirectUrl) {
          file.close();
          fs.unlinkSync(dest);
          return download(redirectUrl, dest).then(resolve).catch(reject);
        }
      }

      if (response.statusCode !== 200) {
        file.close();
        fs.unlinkSync(dest);
        return reject(
          new Error(`Failed to download: ${response.statusCode} ${response.statusMessage}`)
        );
      }

      totalBytes = parseInt(response.headers['content-length'] || '0', 10);

      response.on('data', (chunk: Buffer) => {
        downloadedBytes += chunk.length;
        file.write(chunk);

        let now = Date.now();
        let timeSinceLastLog = now - lastLogTime;

        if (timeSinceLastLog >= 5000) {
          let bytesSinceLastLog = downloadedBytes - lastDownloadedBytes;
          let speedBytesPerSecond = (bytesSinceLastLog / timeSinceLastLog) * 1000;
          let speedMbps = (speedBytesPerSecond * 8) / (1024 * 1024);
          let percentage = totalBytes > 0 ? (downloadedBytes / totalBytes) * 100 : 0;

          let downloadedMB = (downloadedBytes / (1024 * 1024)).toFixed(1);
          let totalMB = totalBytes > 0 ? (totalBytes / (1024 * 1024)).toFixed(1) : '?';

          console.log(
            `${downloadedMB}MB/${totalMB}MB (${speedMbps.toFixed(0)}Mb/s - ${percentage.toFixed(0)}%)`
          );

          lastLogTime = now;
          lastDownloadedBytes = downloadedBytes;
        }
      });

      response.on('end', () => {
        file.end();
        console.log(
          `Downloaded ${downloadedBytes} bytes in ${(Date.now() - startTime) / 1000}s`
        );
        resolve();
      });

      response.on('error', err => {
        file.close();
        fs.unlinkSync(dest);
        reject(err);
      });
    });

    request.on('error', err => {
      file.close();
      fs.unlinkSync(dest);
      reject(err);
    });

    file.on('error', err => {
      file.close();
      fs.unlinkSync(dest);
      reject(err);
    });
  });
};
