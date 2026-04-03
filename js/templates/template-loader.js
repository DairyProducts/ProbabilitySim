const templateLoader = {
  cache: {},

  async loadAllTemplates() {
    const entries = [
      ['main', 'js/templates/main.template.html'],
      ['slider', 'js/templates/slider.template.html'],
    ];

    await Promise.all(entries.map(async ([name, path]) => {
      const response = await fetch(path);
      if (!response.ok) {
        throw new Error(`Failed to load template: ${path}`);
      }
      this.cache[name] = await response.text();
    }));
  },

  getTemplate(name) {
    return this.cache[name] || '';
  },

  render(template, values) {
    return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
      const value = values[key];
      return value === undefined || value === null ? '' : String(value);
    });
  },
};

window.templateLoader = templateLoader;
