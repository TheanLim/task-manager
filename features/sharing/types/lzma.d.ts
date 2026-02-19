declare module 'lzma' {
  export function compress(
    data: string,
    mode: number,
    callback: (result: number[] | string, error?: Error) => void
  ): void;
  
  export function decompress(
    data: number[],
    callback: (result: string | number[], error?: Error) => void
  ): void;
  
  export function LZMA(): {
    compress: typeof compress;
    decompress: typeof decompress;
  };
}
