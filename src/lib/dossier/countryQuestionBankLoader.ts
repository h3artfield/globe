import { readJsonFile, repoPath } from "@/lib/pipeline/io";

export type CountryQuestionBankCategory = {
  module?: string;
  id?: string;
  name?: string;
  sample_questions?: string[];
  questions?: string[];
};

export type CountryQuestionBank = {
  version: string;
  categories: CountryQuestionBankCategory[];
};

export async function loadCountryQuestionBank(): Promise<CountryQuestionBank> {
  return readJsonFile<CountryQuestionBank>(repoPath("data", "sources", "question_bank_country.v1.json"));
}

export function questionsForModule(bank: CountryQuestionBank, moduleName: string): string[] {
  return bank.categories
    .filter((category) => category.module === moduleName || category.id === moduleName)
    .flatMap((category) => [...(category.questions ?? []), ...(category.sample_questions ?? [])]);
}
