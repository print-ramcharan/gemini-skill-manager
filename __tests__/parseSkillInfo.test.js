const fs = require('fs');
const os = require('os');
const path = require('path');

jest.mock('electron', () => ({
  app: {
    whenReady: () => ({ then: () => {} }),
    on: jest.fn(),
    getPath: jest.fn(() => '/tmp'),
    dock: { setIcon: jest.fn() }
  },
  BrowserWindow: jest.fn(function BrowserWindow() {
    return {
      webContents: { on: jest.fn(), send: jest.fn() },
      loadFile: jest.fn().mockResolvedValue(undefined)
    };
  }),
  ipcMain: { handle: jest.fn() },
  nativeImage: { createFromPath: jest.fn(() => ({ isEmpty: () => true })) }
}));

jest.mock('gpt-3-encoder', () => ({
  encode: jest.fn((text) => Array.from(text || ''))
}));

const { parseSkillInfo } = require('../main');

describe('parseSkillInfo', () => {
  test('reads frontmatter name and description when present', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsm-skill-'));
    fs.writeFileSync(path.join(tempDir, 'SKILL.md'), `---\nname: Example Skill\ndescription: "Uses the frontmatter parser."\n---\n# Example Skill\n`);

    const result = parseSkillInfo(tempDir, 'example-skill');

    expect(result).toEqual({
      name: 'Example Skill',
      description: 'Uses the frontmatter parser.',
      tokens: expect.any(Number)
    });
  });

  test('falls back to folder name and default description when no frontmatter exists', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsm-skill-'));
    fs.writeFileSync(path.join(tempDir, 'SKILL.md'), '# Plain Skill\nJust content.\n');

    const result = parseSkillInfo(tempDir, 'plain-skill');

    expect(result.name).toBe('plain-skill');
    expect(result.description).toBe('No description available.');
    expect(result.tokens).toBeGreaterThan(0);
  });
});
