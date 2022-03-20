/* eslint-disable import/prefer-default-export */
type Resolver = (relPath: string) => string;

type WithDirCallback = (resolve: Resolver) => Promise<void>;

declare module 'tempdir-yaml' {
  export function withDir(yaml: string, callback: WithDirCallback): Promise<void>;
}
