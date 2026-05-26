export interface CookieOptions {
  maxAge?: number;
  expires?: Date;
  httpOnly?: boolean;
  path?: string;
  domain?: string;
  secure?: boolean;
  sameSite?: boolean | 'lax' | 'strict' | 'none';
  signed?: boolean;
}

export interface HttpHeaders {
  get(name: string): string | null;
}

export interface HttpCookies {
  get(name: string): string | null;
}

export interface HttpQuery {
  get(name: string): string | null;
}

export interface HttpContext {
  readonly headers: HttpHeaders;
  readonly cookies: HttpCookies;
  readonly query: HttpQuery;

  /**
   * 请求级别的共享状态，由核心层写入，由各框架集成层映射到框架习惯位置。
   * 生命周期：与单次请求绑定，每次 createXxxContext() 调用持有同一引用。
   */
  state: Record<string, unknown>;

  setHeader(name: string, value: string): void;
  setCookie(name: string, value: string, options?: CookieOptions): void;

  /** 逃生口：访问框架原始对象 */
  raw<T = unknown>(): T;
}
