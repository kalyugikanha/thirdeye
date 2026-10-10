declare module 'rrweb-player' {
  export interface RRWebPlayerOptions {
    target: HTMLElement;
    props: {
      events: any[];
      width?: number;
      height?: number;
      autoPlay?: boolean;
      speed?: number;
      speedOption?: number[];
      showController?: boolean;
      tags?: Record<string, string>;
      [key: string]: any;
    };
  }

  export default class RRWebPlayer {
    constructor(options: RRWebPlayerOptions);
    addEventListener(event: string, handler: () => void): void;
    play(): void;
    pause(): void;
    goto(timeOffset: number): void;
    destroy(): void;
    [key: string]: any;
  }
}

declare module 'rrweb-player/dist/style.css' {
  const content: any;
  export default content;
}
