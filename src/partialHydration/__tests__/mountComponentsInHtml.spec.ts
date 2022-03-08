import mountComponentsInHtml from '../mountComponentsInHtml';
import { prepareGetUniqueId } from '../../utils/getUniqueId';

function getPage() {
  return {
    settings: {
      distDir: 'test',
      $$internal: {
        ssrComponents: {},
        hashedComponents: {},
        findComponent: (name) => ({ ssr: `ssr/${name}`, client: `client/${name}` }),
      },
    },
    componentsToHydrate: [],
    getUniqueId: prepareGetUniqueId(),
  };
}

const renderComponent = ({ props, path }) => ({
  html: `<div class="component" path="${path}">${JSON.stringify(props)}</div>`,
});
const mount = (options) => mountComponentsInHtml({ renderComponent, ...options });

describe('#mountComponentsInHtml', () => {
  it('mounts a single component in HTML correctly', () => {
    const page = getPage();
    const result = mount({
      html: `<div class="svelte-datepicker"><div class="ejs-component" ejs-mount="[&quot;Datepicker&quot;,{ &quot;a&quot;: &quot;b&quot; },{ &quot;loading&quot;: &quot;lazy&quot; }]"></div></div>`,
      page,
    });
    expect(result).toMatchInlineSnapshot(
      `"<div class=\\"svelte-datepicker\\"><div ejs-id=\\"0\\" class=\\"ejs-component datepicker-component\\"><div class=\\"component\\" path=\\"ssr/Datepicker\\">{\\"a\\":\\"b\\"}</div></div></div>"`,
    );
    expect(page.componentsToHydrate).toMatchInlineSnapshot(`
      Array [
        Object {
          "client": "client/Datepicker",
          "hydrateOptions": Object {
            "loading": "lazy",
          },
          "id": "0",
          "name": "0",
          "prepared": Object {},
          "props": Object {
            "a": "b",
          },
        },
      ]
    `);
  });

  it('mounts multiple components within the same html correctly', () => {
    const page = getPage();
    const result = mount({
      html:
        `<div class="svelte-datepicker"><div class="ejs-component" ejs-mount="[&quot;Datepicker&quot;,{ &quot;a&quot;: &quot;b&quot; },{ &quot;loading&quot;: &quot;lazy&quot; }]"></div></div>` +
        `<div class="svelte-datepicker"><div class="ejs-component" ejs-mount="[&quot;Datepicker&quot;,{ &quot;a&quot;: &quot;b&quot; },{ &quot;loading&quot;: &quot;eager&quot; }]"></div></div>`,
      page,
    });
    expect(result).toMatchInlineSnapshot(
      `"<div class=\\"svelte-datepicker\\"><div ejs-id=\\"0\\" class=\\"ejs-component datepicker-component\\"><div class=\\"component\\" path=\\"ssr/Datepicker\\">{\\"a\\":\\"b\\"}</div></div></div><div class=\\"svelte-datepicker\\"><div ejs-id=\\"1\\" class=\\"ejs-component datepicker-component\\"><div class=\\"component\\" path=\\"ssr/Datepicker\\">{\\"a\\":\\"b\\"}</div></div></div>"`,
    );
    expect(page.componentsToHydrate).toMatchInlineSnapshot(`
      Array [
        Object {
          "client": "client/Datepicker",
          "hydrateOptions": Object {
            "loading": "lazy",
          },
          "id": "0",
          "name": "0",
          "prepared": Object {},
          "props": Object {
            "a": "b",
          },
        },
        Object {
          "client": "client/Datepicker",
          "hydrateOptions": Object {
            "loading": "eager",
          },
          "id": "1",
          "name": "1",
          "prepared": Object {},
          "props": Object {
            "a": "b",
          },
        },
      ]
    `);
  });

  it('mounts 3 components within the same html correctly', () => {
    const page = getPage();
    const result = mount({
      html:
        `<div class="svelte-datepicker"><div class="ejs-component" ejs-mount="[&quot;Datesicker&quot;,{ &quot;a&quot;: &quot;b&quot; },{ &quot;loading&quot;: &quot;lazy&quot; }]"></div></div>` +
        `<div class="svelte-datepicker"><div class="ejs-component" ejs-mount="[&quot;Datepicker&quot;,{ &quot;a&quot;: &quot;b&quot; },{ &quot;loading&quot;: &quot;eager&quot; }]"></div></div>` +
        `<div class="svelte-datepicker"><div class="ejs-component" ejs-mount="[&quot;Datericker&quot;,{ &quot;a&quot;: &quot;b&quot; },{ &quot;loading&quot;: &quot;lazy&quot; }]"></div></div>`,
      page,
    });
    expect(result).toMatchInlineSnapshot(
      `"<div class=\\"svelte-datepicker\\"><div ejs-id=\\"0\\" class=\\"ejs-component datesicker-component\\"><div class=\\"component\\" path=\\"ssr/Datesicker\\">{\\"a\\":\\"b\\"}</div></div></div><div class=\\"svelte-datepicker\\"><div ejs-id=\\"1\\" class=\\"ejs-component datepicker-component\\"><div class=\\"component\\" path=\\"ssr/Datepicker\\">{\\"a\\":\\"b\\"}</div></div></div><div class=\\"svelte-datepicker\\"><div ejs-id=\\"2\\" class=\\"ejs-component datericker-component\\"><div class=\\"component\\" path=\\"ssr/Datericker\\">{\\"a\\":\\"b\\"}</div></div></div>"`,
    );
    expect(page.componentsToHydrate).toMatchInlineSnapshot(`
      Array [
        Object {
          "client": "client/Datesicker",
          "hydrateOptions": Object {
            "loading": "lazy",
          },
          "id": "0",
          "name": "0",
          "prepared": Object {},
          "props": Object {
            "a": "b",
          },
        },
        Object {
          "client": "client/Datepicker",
          "hydrateOptions": Object {
            "loading": "eager",
          },
          "id": "1",
          "name": "1",
          "prepared": Object {},
          "props": Object {
            "a": "b",
          },
        },
        Object {
          "client": "client/Datericker",
          "hydrateOptions": Object {
            "loading": "lazy",
          },
          "id": "2",
          "name": "2",
          "prepared": Object {},
          "props": Object {
            "a": "b",
          },
        },
      ]
    `);
  });

  it('Extracts from Alock, Block, Clock', () => {
    const page = getPage();
    const result = mount({
      page,
      html: `<div class="problem">
      <div class="ejs-component" ejs-mount='["Clock",{},{&quot;loading&quot;:&quot;eager&quot;,&quot;preload&quot;:true}]'></div>
      <div class="ejs-component" ejs-mount='["Block",{},{&quot;loading&quot;:&quot;lazy&quot;}]'></div>
      <div class="ejs-component" ejs-mount='["Alock",{},{&quot;loading&quot;:&quot;lazy&quot;}]'></div>
      </div>`,
    });
    expect(result).toMatchInlineSnapshot(`
      "<div class=\\"problem\\">
            <div ejs-id=\\"0\\" class=\\"ejs-component clock-component\\"><div class=\\"component\\" path=\\"ssr/Clock\\">{}</div></div>
            <div ejs-id=\\"1\\" class=\\"ejs-component block-component\\"><div class=\\"component\\" path=\\"ssr/Block\\">{}</div></div>
            <div ejs-id=\\"2\\" class=\\"ejs-component alock-component\\"><div class=\\"component\\" path=\\"ssr/Alock\\">{}</div></div>
            </div>"
    `);
    expect(page.componentsToHydrate).toMatchInlineSnapshot(`
      Array [
        Object {
          "client": "client/Clock",
          "hydrateOptions": Object {
            "loading": "eager",
            "preload": true,
          },
          "id": "0",
          "name": "0",
          "prepared": Object {},
          "props": false,
        },
        Object {
          "client": "client/Block",
          "hydrateOptions": Object {
            "loading": "lazy",
          },
          "id": "1",
          "name": "1",
          "prepared": Object {},
          "props": false,
        },
        Object {
          "client": "client/Alock",
          "hydrateOptions": Object {
            "loading": "lazy",
          },
          "id": "2",
          "name": "2",
          "prepared": Object {},
          "props": false,
        },
      ]
    `);
  });

  it('options.element', () => {
    const page = getPage();
    const result = mount({
      page,
      html: `<ejswrapper ejs-mount='["Foo",null,{"element": "span"}]'></ejswrapper>`,
    });
    expect(result).toMatchInlineSnapshot(
      `"<span ejs-id=\\"0\\" class=\\"foo-component\\"><div class=\\"component\\" path=\\"ssr/Foo\\">null</div></span>"`,
    );
    expect(page.componentsToHydrate).toMatchInlineSnapshot(`
      Array [
        Object {
          "client": "client/Foo",
          "hydrateOptions": Object {
            "element": "span",
          },
          "id": "0",
          "name": "0",
          "prepared": Object {},
          "props": false,
        },
      ]
    `);
  });

  it('loading = none', () => {
    const page = getPage();
    const result = mount({
      page,
      html: `<ejswrapper ejs-mount='["Foo",null,{"loading":"none"}]'></ejswrapper>`,
    });
    expect(result).toMatchInlineSnapshot(`"<div class=\\"component\\" path=\\"ssr/Foo\\">null</div>"`);
    expect(page.componentsToHydrate).toMatchInlineSnapshot(`Array []`);
  });

  it('loading = none with style attribute', () => {
    const page = getPage();
    const result = mount({
      page,
      html: `<ejswrapper ejs-mount='["Foo",null,{"loading":"none"}]' style="color: red"></ejswrapper>`,
    });
    expect(result).toMatchInlineSnapshot(
      `"<div style=\\"color: red\\" class=\\"foo-component\\"><div class=\\"component\\" path=\\"ssr/Foo\\">null</div></div>"`,
    );
    expect(page.componentsToHydrate).toMatchInlineSnapshot(`Array []`);
  });

  it('Performance test (#235)', () => {
    const comp = `<p><div class="ejs-component" ejs-mount='["Sicker",{ &quot;a&quot;: &quot;b&quot; },{ &quot;loading&quot;: &quot;lazy&quot; }]'></div></p>\n`;
    mount({
      page: getPage(),
      html: comp.repeat(1000),
    });
  });
});
