export type ImportValidateArgs = {
  strict: boolean;
  sources: string[];
};

function readNpmForwardedArgs(): string[] {
  const raw = process.env.npm_config_argv;
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as {
      remain?: string[];
      original?: string[];
      cooked?: string[];
    };

    if (parsed.remain?.length) {
      return parsed.remain;
    }

    const original = parsed.original ?? parsed.cooked ?? [];
    const separatorIndex = original.indexOf("--");
    if (separatorIndex >= 0) {
      return original.slice(separatorIndex + 1);
    }
  } catch {
    return [];
  }

  return [];
}

export function getImportValidateCliArgs(): string[] {
  const fromProcess = process.argv
    .slice(2)
    .filter((arg) => !arg.endsWith(".ts") && !arg.endsWith(".js"));

  if (fromProcess.length > 0) {
    return fromProcess;
  }

  return readNpmForwardedArgs();
}

export function parseImportValidateArgs(argv: string[]): ImportValidateArgs {
  const strict = argv.includes("--strict");
  const sources: string[] = [];

  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--source" && argv[index + 1]) {
      sources.push(argv[index + 1].trim().toLowerCase());
      index += 1;
    }
  }

  return { strict, sources };
}

export function resolveExitCode(input: {
  strict: boolean;
  results: Array<{ passed: boolean; filesChecked: string[] }>;
}): number {
  const passCount = input.results.filter((result) => result.passed).length;
  const hasSchemaErrors = input.results.some(
    (result) => result.filesChecked.length > 0 && !result.passed,
  );

  if (input.strict) {
    return passCount === input.results.length ? 0 : 1;
  }

  if (passCount === 0 || hasSchemaErrors) {
    return 1;
  }

  return 0;
}
