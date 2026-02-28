import fs from 'fs-extra';
import { generateSite, getStyles } from '../src/generator';
import * as runner from '../src/runner';

jest.mock('fs-extra');
jest.mock('ejs', () => ({
  render: jest.fn().mockResolvedValue('<html>MOCK HTML</html>')
}));

describe('generator', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getStyles', () => {
    it('returns a string containing CSS', () => {
      const styles = getStyles();
      expect(typeof styles).toBe('string');
      expect(styles).toContain(':root');
      expect(styles).toContain('.lang-options');
    });
  });

  describe('generateSite', () => {
    it('throws error if input spec file does not exist', async () => {
      (fs.pathExists as jest.Mock).mockResolvedValue(false);
      await expect(generateSite({ inputPath: 'missing.json', outputPath: 'out' }))
        .rejects.toThrow('OpenAPI spec not found at:');
    });

    it('generates site successfully with minimal spec and resolves initialVariant appropriately', async () => {
      (fs.pathExists as jest.Mock).mockResolvedValue(true);
      (fs.readJson as jest.Mock).mockResolvedValue({});
      (fs.readFile as unknown as jest.Mock).mockResolvedValue('<%= apiName %>');
      const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

      const collectSpy = jest.spyOn(runner, 'collectAllExamples').mockResolvedValue({});

      await generateSite({ inputPath: 'spec.json', outputPath: 'out', noImports: true, noWrapping: true });

      expect(fs.emptyDir).toHaveBeenCalled();
      expect(fs.ensureDir).toHaveBeenCalled();
      expect(fs.writeFile).toHaveBeenCalled();
      expect(fs.writeJson).toHaveBeenCalledWith(expect.stringContaining('examples.json'), expect.any(Object));

      // Because spec info title is undefined, apiName should fallback to 'api'
      expect(fs.ensureDir).toHaveBeenCalledWith(expect.stringContaining('api/api/python'));

      logSpy.mockRestore();
      collectSpy.mockRestore();
    });

    it('generates site successfully with full spec mapping petstore override', async () => {
      (fs.pathExists as jest.Mock).mockResolvedValue(true);
      const spec = {
        info: { title: 'Swagger Petstore' },
        paths: {
          '/pets': {
            get: { summary: 'List pets', tags: ['pets'] },
            post: {},
            options: {} // Should be ignored
          }
        }
      };
      (fs.readJson as jest.Mock).mockResolvedValue(spec);
      (fs.readFile as unknown as jest.Mock).mockResolvedValue('<html>MOCK</html>');
      const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

      const mockExampleData = {
        python: {
          default: { endpoints: { '/pets': { get: 'py get default' } } },
          noImports: { endpoints: { '/pets': { get: 'py get no imp' } } },
          noWrapping: { endpoints: { '/pets': { get: 'py get no wrap' } } },
          noImportsNoWrapping: { endpoints: { '/pets': { get: 'py get none' } } }
        }
      };

      const collectSpy = jest.spyOn(runner, 'collectAllExamples').mockResolvedValue(mockExampleData);

      await generateSite({ inputPath: 'spec.json', outputPath: 'out', noImports: true, noWrapping: false });

      expect(fs.ensureDir).toHaveBeenCalledWith(expect.stringContaining('api/petstore/python'));
      expect(collectSpy).toHaveBeenCalledWith(expect.any(String));
      
      logSpy.mockRestore();
      collectSpy.mockRestore();
    });

    it('normalizes title spaces and characters properly and checks noImports option logic', async () => {
      (fs.pathExists as jest.Mock).mockResolvedValue(true);
      const spec = {
        info: { title: 'My Awesome API v2!' }
      };
      (fs.readJson as jest.Mock).mockResolvedValue(spec);
      (fs.readFile as unknown as jest.Mock).mockResolvedValue('<html>MOCK</html>');
      const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
      const collectSpy = jest.spyOn(runner, 'collectAllExamples').mockResolvedValue({});

      await generateSite({ inputPath: 'spec.json', outputPath: 'out', noImports: true });

      expect(fs.ensureDir).toHaveBeenCalledWith(expect.stringContaining('api/my-awesome-api-v2-/python'));

      logSpy.mockRestore();
      collectSpy.mockRestore();
    });

    it('checks noWrapping option logic independently', async () => {
      (fs.pathExists as jest.Mock).mockResolvedValue(true);
      (fs.readJson as jest.Mock).mockResolvedValue({});
      (fs.readFile as unknown as jest.Mock).mockResolvedValue('<html>MOCK</html>');
      const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
      const collectSpy = jest.spyOn(runner, 'collectAllExamples').mockResolvedValue({});

      await generateSite({ inputPath: 'spec.json', outputPath: 'out', noWrapping: true });

      expect(fs.ensureDir).toHaveBeenCalledWith(expect.stringContaining('api/api/python'));

      logSpy.mockRestore();
      collectSpy.mockRestore();
    });

    it('checks default initialVariant when no booleans are provided', async () => {
      (fs.pathExists as jest.Mock).mockResolvedValue(true);
      (fs.readJson as jest.Mock).mockResolvedValue({});
      (fs.readFile as unknown as jest.Mock).mockResolvedValue('<html>MOCK</html>');
      const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
      const collectSpy = jest.spyOn(runner, 'collectAllExamples').mockResolvedValue({});

      await generateSite({ inputPath: 'spec.json', outputPath: 'out' });

      expect(fs.ensureDir).toHaveBeenCalledWith(expect.stringContaining('api/api/python'));

      logSpy.mockRestore();
      collectSpy.mockRestore();
    });
  });
});