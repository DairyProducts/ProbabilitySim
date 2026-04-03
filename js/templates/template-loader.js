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
      const html = await response.text();
      const container = document.createElement('div');
      container.innerHTML = html.trim();
      const template = container.querySelector('template');
      if (!template) {
        throw new Error(`Template tag not found in: ${path}`);
      }
      this.cache[name] = template;
    }));
  },

  cloneTemplate(name) {
    const template = this.cache[name];
    if (!template) {
      throw new Error(`Template not loaded: ${name}`);
    }
    return template.content.cloneNode(true);
  },
};

window.templateLoader = templateLoader;
