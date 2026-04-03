import { migrateToTiPTap } from './src/lib/editor/migration';

const blocknote = [
  { id: '1', type: 'bulletListItem', props: {}, content: [{ type: 'text', text: 'Item', styles: {} }], children: [] }
];

const result = migrateToTiPTap(blocknote);
console.log('Result Type:', result.type);
console.log('Content[0] Type:', result.content[0].type);
if (result.content[0].content) {
    console.log('Content[0] Child[0] Type:', result.content[0].content[0].type);
}
