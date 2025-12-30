// types/html-docx-js.d.ts
declare module 'html-docx-js' {
  interface DocxOptions {
    orientation?: 'portrait' | 'landscape';
    margins?: {
      top?: number;
      right?: number;
      bottom?: number;
      left?: number;
    };
  }

  export function asBlob(htmlString: string, options?: DocxOptions): Blob;
  export function asBuffer(htmlString: string, options?: DocxOptions): Buffer;
}