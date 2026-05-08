import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import { Blueprint } from './workflow/Blueprint';
import Chain from './types/Chain';
import Step from './types/Step';

const PORT = 3005;

const server = http.createServer(async (req, res) => {
    // 跨域设置
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    // 提供前端 HTML 页面
    if (req.method === 'GET' && req.url === '/') {
        const publicPath = path.join(__dirname, '../public/designer.html');
        if (!fs.existsSync(publicPath)) {
            res.writeHead(404);
            res.end("UI File not found");
            return;
        }
        const html = fs.readFileSync(publicPath, 'utf-8');
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(html);
        return;
    }

    // 获取当前流程图纸
    if (req.method === 'GET' && req.url?.startsWith('/api/chain')) {
        const chainId = "CHAIN_TEST_001"; // 写死一个测试 ID
        try {
            const chain = await Blueprint.load(chainId);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(chain));
        } catch(e) {
            // 如果查不到，说明数据库是空的，我们 mock 一个给他体验！
            const dummyChain = new Chain({ id: chainId, name: "🚜 玉米种植全自动流水线" });
            const s1 = new Step({ id: "STEP_1", name: "选种与购买" });
            const s2 = new Step({ id: "STEP_2", name: "松土施底肥" });
            const s3 = new Step({ id: "STEP_3", name: "播种与浇水" });
            const s4 = new Step({ id: "STEP_4", name: "秋季收割" });
            dummyChain.newStep(s1, null).newStep(s2, "STEP_1").newStep(s3, "STEP_2").newStep(s4, "STEP_3");
            
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(dummyChain));
        }
        return;
    }

    // 保存图纸
    if (req.method === 'POST' && req.url === '/api/chain') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
            try {
                const data = JSON.parse(body);
                // 1. 重建内存中的 Chain
                const chain = new Chain({ id: data.template.id, name: data.template.name, description: data.template.description });
                
                // 2. 根据前端传回来的新顺序，重新分配 previousId 和 nextId
                const stepsData = data.steps || [];
                let prevId = null;
                for (let i = 0; i < stepsData.length; i++) {
                    const sd = stepsData[i];
                    const step = new Step({ id: sd.template.id, name: sd.template.name, subChainId: sd.template.subChainId });
                    
                    step.template.previousId = prevId;
                    if (i < stepsData.length - 1) {
                        step.template.nextId = stepsData[i+1].template.id;
                    } else {
                        step.template.nextId = null;
                    }
                    chain.steps.push(step);
                    prevId = step.template.id;
                }
                chain.buildChain(); // 同步内存链表指针
                
                // 3. 调用 Blueprint 落库！
                await Blueprint.save(chain);
                
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, message: "Saved!" }));
            } catch (e: any) {
                console.error(e);
                res.writeHead(500);
                res.end(e.message);
            }
        });
        return;
    }

    res.writeHead(404);
    res.end("Not found");
});

server.listen(PORT, () => {
    console.log(`\n========================================`);
    console.log(`🚀 设计器启动成功！请打开浏览器访问:`);
    console.log(`👉 http://localhost:${PORT}/`);
    console.log(`========================================\n`);
});
