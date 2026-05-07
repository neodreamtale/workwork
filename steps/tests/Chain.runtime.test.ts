import { describe, it, expect } from '@jest/globals';
import Chain from '../types/Chain';
import Step from '../types/Step';
import { assert } from 'console';


describe('Chain runtime basics', () => {
  let id = "hahahahaha"
  it('accepts a Chain with steps and links them', async () => {
    const s1 = new Step<String>('step1', '第1步');
    s1.chainId = id;
    s1.currentStepIndex = 0;
    s1.payload = '翻地';

    const s2 = new Step<String>('step2', '第2步');
    s2.chainId = id;
    s2.currentStepIndex = 1;
    s2.payload = '种树';

    const s21 = new Step<String>('挖坑', '第2-1步');
    s21.chainId = id;
    s21.currentStepIndex = 1;
    s21.payload = '挖坑';
    s21.parentId = '第2步';

    const s22 = new Step<String>('栽树', '第2-2步');
    s22.chainId = id;
    s22.currentStepIndex = 1;
    s22.payload = '栽树';
    s22.parentId = '第2步';

    await Chain.loadById(id, true)
      .then(chain => {
        chain.modifyName('种树链');
        assert(chain.name === '种树链');
        chain.progressWithId('第2步');
        expect(chain.nowStepId).toBe('第2步');

        chain.newStep(s1, null)
          .newStep(s2, null)
          .newStep(s21, null)
          .newStep(s22, null)
          .buildChain();
      });
  });

  it('pushes a new step and keeps order', () => {

  });
});
