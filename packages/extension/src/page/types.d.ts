export type Passage = {
  classes: string[],
  domId: string,
  element: HTMLElement,
  tags: string[],
  title: string,
  description: () => string,
}
// Many fields are omitted
export type SugarCube = {
  State: {
    passage: string
  },
  Save: {
    serialize: () => string;
    deserialize: (base64str: string) => void;
    base64?: {
      save: () => string,
      load: (base64: string) => Promise<void>
    }
  },
  Story: {
    get: (title: string) => Passage,
    title: string,
  },
  Engine: {
    show: () => HTMLElement
  },
  version: {
    title: string,
    major: number,
    minor: number,
    patch: number,
  }
}

