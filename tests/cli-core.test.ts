import { runCli } from '../src/cli-core';
import * as generator from '../src/generator';

jest.mock('../src/generator', () => ({
  generateSite: jest.fn()
}));

describe('cli-core', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('runs successfully with default options', async () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    (generator.generateSite as jest.Mock).mockResolvedValue(undefined);

    const result = await runCli(['node', 'script', '-i', 'spec.json', '-o', 'out']);
    
    expect(result).toBe(true);
    expect(generator.generateSite).toHaveBeenCalledWith({
      inputPath: 'spec.json',
      outputPath: 'out',
      noImports: false,
      noWrapping: false
    });
    
    logSpy.mockRestore();
  });

  it('runs successfully with boolean flags', async () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    (generator.generateSite as jest.Mock).mockResolvedValue(undefined);

    const result = await runCli(['node', 'script', '-i', 'spec.json', '-o', 'out', '--no-imports', '--no-wrapping']);
    
    expect(result).toBe(true);
    expect(generator.generateSite).toHaveBeenCalledWith({
      inputPath: 'spec.json',
      outputPath: 'out',
      noImports: true,
      noWrapping: true
    });
    
    logSpy.mockRestore();
  });

  it('handles generator errors gracefully and returns false', async () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    
    (generator.generateSite as jest.Mock).mockRejectedValue(new Error('Generator failed'));

    const result = await runCli(['node', 'script', '-i', 'spec.json', '-o', 'out']);
    
    expect(result).toBe(false);
    expect(errSpy).toHaveBeenCalledWith('Error generating site:', 'Generator failed');
    
    logSpy.mockRestore();
    errSpy.mockRestore();
  });

  it('handles string errors gracefully and returns false', async () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    
    (generator.generateSite as jest.Mock).mockRejectedValue('String Error');

    const result = await runCli(['node', 'script', '-i', 'spec.json', '-o', 'out']);
    
    expect(result).toBe(false);
    expect(errSpy).toHaveBeenCalledWith('Error generating site:', 'String Error');
    
    logSpy.mockRestore();
    errSpy.mockRestore();
  });
});