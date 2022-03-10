import { ShortcodeDefs } from './types';

const shortcodes: ShortcodeDefs = [
  {
    shortcode: 'component',
    run: async ({ props, helpers }) => {
      if (!props.name) throw new Error(`component shortcode requires a name="" property.`);

      let parsedProps = {};
      try {
        parsedProps = JSON.parse(props.props);
      } catch {
        console.error(`Can't parse ${props.name} component props=${props.props} to JSON. It needs to be serializable.`);
      }

      let parsedOptions = {};
      try {
        parsedOptions = JSON.parse(props.options);
      } catch {
        console.error(
          `Can't parse ${props.name} component options=${props.options} to JSON. It needs to be serializable.`,
        );
      }
      return {
        html: helpers.inlineSvelteComponent({
          name: props.name,
          props: parsedProps,
          options: parsedOptions,
        }),
      };
    },
    $$meta: {
      addedBy: 'elder',
      type: 'elder',
    },
  },
];

export default shortcodes;
