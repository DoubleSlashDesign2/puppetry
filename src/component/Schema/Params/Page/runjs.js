import { TEXTAREA } from "../../constants";
import { justify } from "service/assert";

export const runjs = {
  template: ({ params }) => {
    const { value } = params;
    return justify( `
// Run custom JavaScript in the test
${ value }
` );
  },
  description: `Run custom JavaScript code in the test suite with use of Puppeteer API (https://pptr.dev).
  You can access in your code Puppeteer Browser instance as 'bs', Page instance as 'bs.page'.
  All the available methods asynchronus  so you shall use them as 'await bs.page.goto( url );'
  Element handlers correposning your defined targets you can reach like 'await INPUT_FNAME()'.
  For example 'await ( await INPUT_FNAME() ).type( "Jon" );' Where 'png' function is an available helper
  to build a valid file name fomr title.
  Besides you can use Node.js modules. E.g.
  'require( "http" ).request(..)'
  `,
  params: [
    {
      inline: true,
      legend: "",
      tooltip: "",
      items: [
        {
          name: "params.value",
          control: TEXTAREA,
          label: "JavaScript code to run",
          initialValue: "",
          placeholder: "await bs.page.goto('https://example.com');\n"
            + "await bs.page.screenshot( png( \"we are here\" ) );",
          rules: [{
            required: true,
            message: "Code is required"
          }]
        }

      ]
    }
  ]
};