import { expect, it } from "bun:test"
import { Effect } from "effect"
import type { Proto } from "zapo-js"
import { utils as workbookUtils, write as writeWorkbook } from "xlsx"
import { describeMedia, processMedia, unwrapMessage } from "../../src/whatsapp-native/inbound-media"

const successfulTranscript = { transcribe: () => Effect.succeed("bom dia, preciso de ajuda com o relatório") }
const failingTranscript = { transcribe: () => Effect.fail(new Error("serviço indisponível")) }

function pdfBytes(text: string): Uint8Array {
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 200] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    "",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ]
  const stream = `BT /F1 12 Tf 20 100 Td (${text}) Tj ET`
  objects[3] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`
  let output = "%PDF-1.4\n"
  const offsets: number[] = []
  for (const [index, object] of objects.entries()) {
    offsets.push(output.length)
    output += `${index + 1} 0 obj\n${object}\nendobj\n`
  }
  const xref = output.length
  output += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  for (const offset of offsets) output += `${String(offset).padStart(10, "0")} 00000 n \n`
  output += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  return new TextEncoder().encode(output)
}

function workbookBytes(): Uint8Array {
  const workbook = workbookUtils.book_new()
  const sheet = workbookUtils.aoa_to_sheet([
    ["nome", "valor"],
    ["Ana", 10],
    ["Bia", 20],
  ])
  workbookUtils.book_append_sheet(workbook, sheet, "Vendas")
  return new Uint8Array(writeWorkbook(workbook, { type: "array", bookType: "xlsx" }) as ArrayBuffer)
}

it("describeMedia reconhece nota de voz e documento com legenda", () => {
  const audio = describeMedia({
    audioMessage: { mimetype: "audio/ogg; codecs=opus", ptt: true, seconds: 7 },
  } as Proto.IMessage)

  expect(audio?.kind).toBe("audio")
  expect(audio?.mime).toBe("audio/ogg; codecs=opus")
  expect(audio?.metadata.voz).toBe("sim")

  const document = unwrapMessage({
    documentWithCaptionMessage: {
      message: {
        documentMessage: {
          mimetype: "application/pdf",
          fileName: "relatorio.pdf",
          caption: "segue o relatório",
        },
      },
    },
  } as Proto.IMessage)

  expect(document?.documentMessage?.fileName).toBe("relatorio.pdf")
})

it("áudio é transcrito e entregue ao agente como texto", async () => {
  const message = {
    audioMessage: { mimetype: "audio/ogg; codecs=opus", ptt: true, seconds: 4 },
  } as Proto.IMessage
  const descriptor = describeMedia(message)
  if (!descriptor) throw new Error("descriptor ausente")

  const processed = await Effect.runPromise(
    processMedia({
      descriptor,
      bytes: new Uint8Array([1, 2, 3]),
      processors: successfulTranscript,
    }),
  )

  expect(processed.text).toContain("Mensagem de voz recebido")
  expect(processed.text).toContain("Transcrição do áudio")
  expect(processed.text).toContain("bom dia, preciso de ajuda com o relatório")
  expect(processed.attachments).toHaveLength(1)
  expect(processed.attachments[0]?.url.startsWith("data:audio/")).toBe(true)
})

it("falha de transcrição vira contexto explícito e não rejeita o processamento", async () => {
  const descriptor = describeMedia({
    audioMessage: { mimetype: "audio/ogg", ptt: false, seconds: 2 },
  } as Proto.IMessage)
  if (!descriptor) throw new Error("descriptor ausente")

  const processed = await Effect.runPromise(
    processMedia({
      descriptor,
      bytes: new Uint8Array([1, 2, 3]),
      processors: failingTranscript,
    }),
  )

  expect(processed.text).toContain("Áudio disponibilizado")
  expect(processed.attachments).toHaveLength(1)
  expect(processed.attachments[0]?.url.startsWith("data:audio/")).toBe(true)
})

it("planilha XLSX é lida como dados estruturados por aba", async () => {
  const descriptor = describeMedia({
    documentMessage: {
      mimetype: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      fileName: "vendas.xlsx",
    },
  } as Proto.IMessage)
  if (!descriptor) throw new Error("descriptor ausente")

  const processed = await Effect.runPromise(
    processMedia({
      descriptor,
      bytes: workbookBytes(),
      processors: successfulTranscript,
    }),
  )

  expect(processed.text).toContain("Documento recebido: vendas.xlsx")
  expect(processed.text).toContain("lida como dados estruturados")
  expect(processed.text).toContain("### Aba: Vendas")
  expect(processed.text).toContain("Ana")
  expect(processed.text).toContain("Bia")
})

it("PDF tem o texto extraído para o agente", async () => {
  const descriptor = describeMedia({
    documentMessage: { mimetype: "application/pdf", fileName: "contrato.pdf" },
  } as Proto.IMessage)
  if (!descriptor) throw new Error("descriptor ausente")

  const processed = await Effect.runPromise(
    processMedia({
      descriptor,
      bytes: pdfBytes("contrato assinado"),
      processors: successfulTranscript,
    }),
  )

  expect(processed.text).toContain("Documento recebido: contrato.pdf")
  expect(processed.text).toContain("Conteúdo extraído")
  expect(processed.text).toContain("contrato assinado")
  expect(processed.attachments).toHaveLength(0)
})

it("CSV é entregue como texto e imagem vira anexo multimodal", async () => {
  const csv = describeMedia({
    documentMessage: { mimetype: "text/csv", fileName: "contas.csv" },
  } as Proto.IMessage)
  if (!csv) throw new Error("descriptor ausente")

  const processedCsv = await Effect.runPromise(
    processMedia({
      descriptor: csv,
      bytes: new TextEncoder().encode("conta,valor\nluz,120\n"),
      processors: successfulTranscript,
    }),
  )
  expect(processedCsv.text).toContain("conta,valor")
  expect(processedCsv.text).toContain("luz,120")

  const image = describeMedia({
    imageMessage: { mimetype: "image/png", width: 640, height: 480, caption: "print do erro" },
  } as Proto.IMessage)
  if (!image) throw new Error("descriptor ausente")

  const processedImage = await Effect.runPromise(
    processMedia({
      descriptor: image,
      bytes: new Uint8Array([137, 80, 78, 71]),
      processors: successfulTranscript,
    }),
  )
  expect(processedImage.text).toContain("Imagem recebido")
  expect(processedImage.text).toContain("print do erro")
  expect(processedImage.attachments).toHaveLength(1)
  expect(processedImage.attachments[0]?.url.startsWith("data:image/png;base64,")).toBe(true)
})

it("vídeo é tratado de forma degradada, mas explícita", async () => {
  const descriptor = describeMedia({
    videoMessage: { mimetype: "video/mp4", seconds: 30, width: 1280, height: 720 },
  } as Proto.IMessage)
  if (!descriptor) throw new Error("descriptor ausente")

  const processed = await Effect.runPromise(
    processMedia({
      descriptor,
      bytes: new Uint8Array([1, 2, 3]),
      processors: successfulTranscript,
    }),
  )

  expect(processed.text).toContain("Vídeo recebido")
  expect(processed.text).toContain("não é extraído diretamente")
  expect(processed.attachments).toHaveLength(0)
})
