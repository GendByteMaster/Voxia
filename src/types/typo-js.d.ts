declare module 'typo-js' {
    type TypoOptions = {
        platform?: string;
    };

    export default class Typo {
        constructor(dictionary: string, affData: string, dicData: string, options?: TypoOptions);
        check(word: string): boolean;
        suggest(word: string, limit?: number): string[];
    }
}
