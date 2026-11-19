---
录入: "2026-11-17"
修订: "2026-11-18"
存档: "2026-11-17"
原文题名: "Julian Togelius"
作者: []
原作年份: null
翻译年份: null
处理状态: "持续维护"
ISBN: ""
DOI: ""
来源链接: "https://julian.togelius.com/"
来源版本年份: ""
原文语言: ""
来源许可: ""
相关文章: []
相关书目: []
相关作品: []
档案卡片: ["[Gillian Smith](../entry/b7cea904c054a5/)","[Mark O. Riedl](../entry/c8e76df4a093a5/)","[Springer](../entry/8be4fec8cff02c/)","[The MIT Press](../entry/d71fe0818b0a88/)","[Georgios N. Yannakakis](../entry/37913ea1b012de/)","[Noor Shaker](../entry/4827fd0ebe9320/)","[Antonios Liapis](../entry/17baefdc298aca/)"]
索引标签: ["[能动性](../entry/045417f114f81f/)","[自动课程](../entry/d5ceb82f3e94b6/)","[程序化内容生成](../entry/86b7ed30aafb9e/)","[表达范围分析](../entry/ebbd5983d89ca5/)","[体验驱动程序化内容生成](../entry/2aa98ab5a3a8bc/)"]
参考资料: ["[玩与游戏研究入门](../entry/d17e6605cb0592/)","[玩与游戏中的智能体：从逻辑推理到开放式探索](../entry/e354d6d6d1e953/)"]
---

# 简介

Julian Togelius 是瑞典计算机科学家，研究游戏人工智能、程序化内容生成、演化计算与通用智能。截至2026年11月，他任纽约大学计算机科学与工程教授、Game Innovation Lab 主任，并兼任 Nof1 的 Head of AI。他参与建立游戏AI竞赛与研究框架，研究机器怎样玩游戏、创造内容和理解玩家，也通过教材与面向公众的著作讨论游戏对于智能研究的意义。

## 一、从哲学、适应系统到游戏AI

Togelius 的教育经历跨越理论哲学与计算机科学：2002年在隆德大学取得理论哲学学士学位，2003年在萨塞克斯大学取得演化与适应系统硕士学位，2007年在埃塞克斯大学取得计算机科学博士学位，博士导师为 Simon M. Lucas。其本人2026年11月7日版履历逐项列出这些经历。[本人履历](https://julian.togelius.com/cv.pdf)。

博士毕业后，他于2007—2009年在瑞士卢加诺 IDSIA 研究，2009年加入哥本哈根 IT 大学，先后任助理教授与副教授；2015年转入纽约大学。履历将纽约大学副教授阶段明确列为2015—2025年，2026年1月起任教授。部分出版物和旧新闻保留早先称谓，应按材料所属时段阅读。[纽约大学官方页面](https://engineering.nyu.edu/faculty/julian-togelius)、[本人主页](https://julian.togelius.com/)。

这条研究道路把适应与设计结合起来。一个智能体可以通过搜索、学习与反馈改变行动；一个游戏环境也可以被搜索、学习与改变。游戏因而既是任务，又是可以生成的新任务来源。Togelius 的工作持续在“训练行动者”和“创造供其行动的世界”之间往返。

## 二、玩游戏：从单一胜负到跨任务能力

游戏为AI提供规则、可重复的环境和可计算反馈，但在某一个熟悉环境中得高分，与迅速学会陌生游戏并非同一能力。Togelius 与多位合作者参与的 General Video Game AI（GVGAI）框架，将这种区分落实为共同的研究工具。

2019年综述说明，GVGAI 于2014年公开推出，使用 Video Game Description Language（VGDL）描述多种游戏，并逐渐形成不同赛道：智能体在不同信息条件下玩未知游戏，或生成新的关卡与规则。该工作由 Diego Perez-Liebana、Jialin Liu、Ahmed Khalifa、Raluca D. Gaina、Togelius 与 Lucas 共同署名。[综述摘要与版本记录](https://arxiv.org/abs/1802.10363)。

共同框架的作用，是让不同算法面对可比较的任务与接口。能否访问模拟器、允许多少计算、测试游戏是否在训练中出现，都会改变成绩的含义。“通用”在这里是一组具体实验条件，不能只由跨过多少款游戏的排行榜位置决定。

生成赛道则把评价方向反转：算法不仅接受任务，还要创造让人或另一个智能体能够游玩的任务。这使游戏AI中的规划、搜索和生成相互依赖，也要求研究者说明评价代理与真实玩家之间有什么差异。

## 三、搜索式生成：表示与评价共同限定设计空间

Togelius、Georgios N. Yannakakis、Kenneth O. Stanley 与 Cameron Browne 在2011年《Search-Based Procedural Content Generation: A Taxonomy and Survey》中，系统整理以演化和其他搜索算法生成游戏内容的方法。论文区分运行时与开发阶段生成、必需与可选内容、随机种子与可控制参数等条件。[作者保存的论文](https://julian.togelius.com/Togelius2011Searchbased.pdf)。

这些区分有直接设计后果。必经关卡的不可完成，会阻断游戏；可选物品中的某个弱小或古怪结果，却可能成为探索的一部分。实时生成还要满足速度、运行时间和质量的可预期性。同一种算法用于不同位置，需要承担不同保证。

在其与 Noor Shaker 合写的教材章节中，搜索式方法被拆为搜索算法、内容表示和评价函数。表示决定哪些变化能够被提出，评价函数决定哪些变化被保留，搜索算法负责在其中探索。[《The search-based approach》](https://www.pcgbook.com/chapter02.pdf)。

例如，若表示只能改变房间数量，就无法搜到改变动作规则的设计；若评价只奖励路径长度，也无法直接推定输出有丰富叙事。这是对方法结构的解释。表示方式与评价规则，共同规定生成器能够探索的创造范围。

## 四、体验驱动：生成给谁、希望产生什么经验

Togelius 与 Yannakakis 于2011年提出 Experience-Driven Procedural Content Generation（EDPCG）框架，将玩家的体验模型接入内容生成。它把个性化、情感与认知建模、内容调整放入同一循环，游戏是其主要示例而非唯一应用。[作者所在机构的论文记录与摘要](https://researcher.itu.dk/p/en/research-outputs/experience-driven-procedural-content-generation)。

2016年教材相关章节进一步说明，玩家模型可以描述行为、偏好或技能，模型又可进入搜索的评价函数。玩家与游戏互相适应：人逐步学会规则，系统也可以依据交互数据调整内容。[《The experience-driven perspective》](https://www.pcgbook.com/chapter10.pdf)。

这里的体验不限于难度。降低敌人速度可以改变挑战，却不直接代表玩家更好奇、更投入或更愿意探索。模型从哪些观察学习、如何获得主观体验资料、不同玩家的目标是否一致，均会影响适应策略。

这一框架还具有需要单独评价的规范问题：系统以何种目标调整人的体验，玩家是否理解这种调整，模型是在支持探索还是延长停留。上述问题是由个性化机制引出的分析方向；某项系统能够预测行为，不能代替对其用途和结果的判断。

## 五、通用关卡生成：面对尚未专门设计过的游戏

2016年《General Video Game Level Generation》由 Khalifa、Diego Perez-Liebana、Lucas 与 Togelius 共同提出。它要求生成器面向一类用 VGDL 描述的游戏，而非只为一款已知游戏制作关卡。原论文给出框架、三个生成器及其比较，并与 GVGAI 的研究工具相连。[原始论文](https://julian.togelius.com/Khalifa2016General.pdf)。

这个问题改变了知识配置。专用生成器可以把某款游戏的对象和套路直接写进程序；面向多种游戏时，生成器必须处理不同规则的约束与行动可能。其困难不只在于地图外观多样，而在于从规则描述中获得怎样的知识，才能提出可游玩的空间。

据此，评价需要明确适用域。一个生成器能够处理某种描述语言中的多个规则集，不等于适用于所有商业游戏；评价代理找到可赢路径，也不等于人类必然觉得有趣。将范围说明清楚，才能看见通用生成相对于专用系统究竟增加了什么能力。

## 六、质量多样性：寻找一组可用而不同的答案

Togelius 参与的2019年《Procedural Content Generation through Quality Diversity》由 Daniele Gravina、Khalifa、Antonios Liapis、Togelius 与 Yannakakis 共同署名。它讨论质量多样性算法如何为游戏内容同时追求品质与行为特征空间的覆盖。[原始论文摘要](https://arxiv.org/abs/1907.04053)。

目标由此从寻找一个最高分结果，转为保存一组质量达标、特征不同的结果。设计者可以在这些结果中浏览、选择或继续修改；适应系统也可以依据需要取得不同内容。论文明确区分这种目标与普通单目标、多目标优化及一般保留多样性的做法。

“多样”仍然依赖所选特征。按路径长度分出的两张地图，未必给人不同体验；视觉差异很大的地图，也可能要求完全相同的行动。因此特征描述不是中立目录，而是决定系统把哪些区别视为有意义的设计选择。该论文通过整理游戏应用与研究问题，推进质量多样性方法在游戏领域的讨论。

## 七、PCGRL：学习一个能够逐步修改关卡的策略

2020年 PCGRL 论文由 Khalifa、Philip Bontrager、Sam Earle 与 Togelius 合作完成。它把关卡设计写成序列决策任务：智能体观察当前地图，修改局部内容，依据离目标更近或更远得到奖励，最后学成一个生成策略。[论文及方法部分](https://arxiv.org/html/2001.09212v3)。

论文比较三种行动表示：Narrow 在指定位置决定是否改图块；Turtle 让智能体移动并修改所在位置；Wide 同时选择改动位置与图块类型。这使“怎样允许修改”成为方法变量。系统还限制一次过程允许改动的比例，以促使策略回应初始地图，而非总把它覆盖成同一个答案。

与每次从头搜索完整关卡相比，训练后的策略可以迅速执行；代价移到训练阶段。它不要求大量既有关卡作监督样本，但仍需要人为规定对象、目标、可计算指标和奖励。“无示例训练”并不等于没有设计知识。

2024年 Earle、Zehua Jiang 与 Togelius 的 PCGRL+ 面对规模和控制问题，把学习与模拟放入 Jax/GPU 并行框架，加入随机地图尺寸和固定关键图块，研究更大、分布外地图上的泛化。作者报告局部观察可以学习更稳健的策略。[2024年论文摘要](https://arxiv.org/abs/2408.12525)。

这里应分别评价训练成本、执行速度、目标满足率、多样性与人能否控制关键部分。一次成功训练不是所有输入下的可玩保证，奖励函数中的代理指标也仍须与实际游戏体验比较。

## 八、著作、研究共同体与公共讨论

Togelius、Shaker 与 Mark J. Nelson 合编的《Procedural Content Generation in Games》于2016年出版，涵盖搜索、构造、语法、规划、回答集编程、体验模型、共同创作与评价。作者网站说明，早期章节稿自2013年公开，当前所列 PDF 为2016年最终作者版本；公开可读的作者版本与出版社版本应分别辨认。[教材官网与章节目录](https://www.pcgbook.com/)。

他与 Yannakakis 合著的《Artificial Intelligence and Games》初版为2018年，2025年第二版重新组织游戏游玩、生成与玩家建模，并加入新的伦理讨论。官网还提供课程与夏校资料，表明知识传播包含教材、练习和研究训练的组织。[教材官方网站](https://gameaibook.org/)。

面向一般读者的《Playing Smart》讨论游戏、自然智能与AI相互启发。出版社列精装版2019年1月出版、电子版2018年12月出版，平装版则为2025年；出版格式的日期差异应保留。[出版社介绍与版本记录](https://mitpress.mit.edu/9780262039031/playing-smart/)。2024年的《Artificial General Intelligence》将讨论扩展到智能与一般性的概念。作者发表时的自述强调，已有方法各有长短，对“一般智能”本身也需要概念澄清。[作者的新书说明](https://togelius.blogspot.com/2024/09/artificial-general-intelligence-book-is.html)。

## 九、机构、产业角色与仍在展开的问题

Togelius 的产业工作应与大学身份分开。本人履历记载其2018年共同创办 modl.ai，2022—2023年曾兼任研究主任；2025年4月起兼任 Nof1 的 AI 负责人，工作涉及金融交易。后者不能自动解释为新的游戏项目，早先职位也不能全部并列成当前任职。

他在公开讨论中持续区分熟练完成既定任务与迅速学习新任务。2026年纽约大学的报道摘要再次以陌生游戏的学习速度讨论这一差异。[官方报道条目](https://engineering.nyu.edu/news/humans-can-still-beat-ai-video-games)。这是一项评价取向：训练计算量、既往接触和外部工具都会影响比较，不能从“击败人类”的单项叙述直接推出通用能力。

综合其工作，核心贡献在于让游戏同时成为可生成的媒介、可比较的实验环境和理解智能的对象。由此也产生长期张力：可计算指标与真实体验、生成多样性与可玩保证、自动适应与玩家自主、竞技成绩与跨任务学习。独立评价这些问题，比将其全部压成“AI将自动创造无限游戏”的预言更能说明研究成果的具体意义。

## 参考文献与阅读入口

1. [本人主页](https://julian.togelius.com/)、[2026年11月7日版履历](https://julian.togelius.com/cv.pdf)、[纽约大学官方档案](https://engineering.nyu.edu/faculty/julian-togelius)。
2. Togelius, Julian, Georgios N. Yannakakis, Kenneth O. Stanley, and Cameron Browne. 2011. [Search-Based Procedural Content Generation: A Taxonomy and Survey](https://julian.togelius.com/Togelius2011Searchbased.pdf)。读取摘要、导论与分类开头，未声称重做全部文献综述。
3. Yannakakis, Georgios N., and Julian Togelius. 2011. [Experience-Driven Procedural Content Generation](https://researcher.itu.dk/p/en/research-outputs/experience-driven-procedural-content-generation)。读取机构保存的作者摘要与书目信息；并读取2016年教材[第二章开头](https://www.pcgbook.com/chapter02.pdf)、[第十章开头](https://www.pcgbook.com/chapter10.pdf)。
4. Perez-Liebana 等. [General Video Game AI: a Multi-Track Framework for Evaluating Agents, Games and Content Generation Algorithms](https://arxiv.org/abs/1802.10363)。读取2019年修订版摘要与版本记录。
5. Khalifa, Ahmed, Diego Perez-Liebana, Simon M. Lucas, and Julian Togelius. 2016. [General Video Game Level Generation](https://julian.togelius.com/Khalifa2016General.pdf). GECCO。读取首页摘要、导论与署名。
6. Gravina 等. 2019. [Procedural Content Generation through Quality Diversity](https://arxiv.org/abs/1907.04053)。读取作者摘要、署名与版本记录。
7. Khalifa, Ahmed, Philip Bontrager, Sam Earle, and Julian Togelius. 2020. [PCGRL: Procedural Content Generation via Reinforcement Learning](https://arxiv.org/html/2001.09212v3)。读取摘要、导论、框架、表示与实验设计相关部分。
8. Earle, Sam, Zehua Jiang, and Julian Togelius. 2024. [PCGRL+: Scaling, Control and Generalization in Reinforcement Learning Level Generators](https://arxiv.org/abs/2408.12525)。读取作者摘要、署名、会议和版本信息。
9. Shaker、Togelius、Nelson. 2016. [Procedural Content Generation in Games](https://www.pcgbook.com/)；Yannakakis、Togelius. 2018／2025. [Artificial Intelligence and Games](https://gameaibook.org/)。核对官网介绍与目录，其中前一本规划章共同作者包括 [Mark O. Riedl 马克·O·里德尔](../entry/c8e76df4a093a5/)，共同创作与评价章作者包括 [Gillian Smith 吉莉安·史密斯](../entry/b7cea904c054a5/)；出版社为 [Springer 施普林格](../entry/8be4fec8cff02c/)。
10. Togelius. [Playing Smart](https://mitpress.mit.edu/9780262039031/playing-smart/)；[Artificial General Intelligence 作者说明](https://togelius.blogspot.com/2024/09/artificial-general-intelligence-book-is.html)。读取出版信息、简介与作者发言。
