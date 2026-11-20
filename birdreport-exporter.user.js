// ==UserScript==
// @name         中国观鸟记录中心 - 郑四总鸟种首加时间线 & 全量记录一键导出
// @namespace    https://github.com/Simple53/birdreportHelper
// @version      1.3.0
// @description  一键分页拉取中国观鸟记录中心全量记录，按郑四总鸟种首加时间线关联首见地点，补全目/科/属/种与拉丁学名，支持导出多表 Excel (.xlsx) / CSV / JSON。
// @author       Simple53
// @homepageURL  https://github.com/Simple53/birdreportHelper
// @supportURL   https://github.com/Simple53/birdreportHelper/issues
// @updateURL    https://raw.githubusercontent.com/Simple53/birdreportHelper/main/birdreport-exporter.user.js
// @downloadURL  https://raw.githubusercontent.com/Simple53/birdreportHelper/main/birdreport-exporter.user.js
// @match        https://www.birdreport.cn/*
// @match        http://www.birdreport.cn/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function (global) {
  'use strict';

  const API_BASE = 'https://api.birdreport.cn/';
  const Z4_TAXON_VERSION = 'Z4-67FA07177A544FBD96006A7CC7489D25';
  const PAGE_SIZE = 200;
  const PAGE_DELAY_MS = 120;
  const MAX_PAGES = 500;
  const AES_KEY_STR = 'C8EB5514AF5ADDB94B2207B08C66601C';
  const AES_IV_STR = '55DD79C6F04E1A67';

  // Build script injects full Zheng-4th-edition dictionary here: { orders, families, genera }
  const TAXONOMY_DICT = {"genera":{"Abroscopus":"拟鹟莺属","Acanthis":"白腰朱顶雀属","Accipiter":"鹰属","Aceros":"皱盔犀鸟属","Acridotheres":"八哥属","Acrocephalus":"苇莺属","Actinodura":"斑翅鹛属","Actitis":"矶鹬属","Aegithalos":"长尾山雀属","Aegithina":"雀鹎属","Aegolius":"鬼鸮属","Aegypius":"秃鹫属","Aerodramus":"金丝燕属","Aethopyga":"太阳鸟属","Agraphospiza":"赤朱雀属","Agropsar":"北椋鸟属","Aix":"鸳鸯属","Alauda":"云雀属","Alaudala":"小短趾百灵属","Alcedo":"翠鸟属","Alcippe":"雀鹛属","Alcurus":"纵纹绿鹎属","Alectoris":"石鸡属","Alophoixus":"冠鹎属","Amandava":"红梅花雀属","Amaurornis":"苦恶鸟属","Ampeliceps":"金冠树八哥属","Anas":"鸭属","Anastomus":"钳嘴鹳属","Anhinga":"蛇鹈属","Anorrhinus":"凤头犀鸟属","Anous":"玄燕鸥属","Anser":"雁属","Anthipes":"白喉姬鹟属","Anthracoceros":"斑犀鸟属","Anthreptes":"食蜜鸟属","Anthus":"鹨属","Antigone":"赤颈鹤属","Aplonis":"辉椋鸟属","Apus":"雨燕属","Aquila":"雕属","Arachnothera":"捕蛛鸟属","Arborophila":"山鹧鸪属","Ardea":"鹭属","Ardenna":"大鹱属","Ardeola":"池鹭属","Arenaria":"翻石鹬属","Artamus":"燕鵙属","Arundinax":"厚嘴苇莺属","Asarcornis":"白翅栖鸭属","Asio":"耳鸮属","Athene":"小鸮属","Aviceda":"鹃隼属","Aythya":"潜鸭属","Babax":"草鹛属","Bambusicola":"竹鸡属","Batrachostomus":"亚洲蟆口鸱属","Blythipicus":"棕啄木鸟属","Bombycilla":"太平鸟属","Botaurus":"麻𫛚属","Brachypodius":"黑头鹎属","Brachypteryx":"短翅鸫属","Brachyramphus":"斑海雀属","Branta":"黑雁属","Bubo":"雕鸮属","Bubulcus":"牛背鹭属","Bucanetes":"沙雀属","Bucephala":"鹊鸭属","Buceros":"角犀鸟属","Bulweria":"燕鹱属","Burhinus":"石鸻属","Butastur":"鵟鹰属","Buteo":"鵟属","Butorides":"绿鹭属","Cacomantis":"八声杜鹃属","Calandrella":"短趾百灵属","Calcarius":"铁爪鹀属","Calidris":"滨鹬属","Callacanthis":"红眉金翅雀属","Calliope":"野鸲属","Calonectris":"猛鹱属","Caprimulgus":"夜鹰属","Carduelis":"金翅雀属","Carpodacus":"朱雀属","Cecropis":"金腰燕属","Centropus":"鸦鹃属","Cephalopyrus":"火帽攀雀属","Cercotrichas":"非洲薮鸲属","Cerorhinca":"角嘴海雀属","Certhia":"旋木雀属","Ceryle":"鱼狗属","Cettia":"树莺属","Ceyx":"三趾翠鸟属","Chaimarrornis":"溪鸲属","Chalcoparia":"直嘴太阳鸟属","Chalcophaps":"金鸠属","Charadrius":"鸻属","Chelidorhynx":"黄腹扇尾鹟属","Chen":"雪雁属","Chionis":"鞘嘴鸥属","Chlamydotis":"波斑鸨属","Chleuasicus":"黑眉鸦雀属","Chlidonias":"浮鸥属","Chloris":"金翅雀属","Chloropsis":"叶鹎属","Cholornis":"褐鸦雀属","Chroicocephalus":"彩头鸥属","Chrysococcyx":"金鹃属","Chrysocolaptes":"金背啄木鸟属","Chrysolophus":"锦鸡属","Chrysomma":"金眼鹛雀属","Chrysophlegma":"黄冠啄木鸟属","Ciconia":"鹳属","Cinclidium":"蓝额长脚地鸲属","Cinclus":"河乌属","Cinnyris":"双领花蜜鸟属","Circaetus":"短趾雕属","Circus":"鹞属","Cissa":"绿鹊属","Cisticola":"扇尾莺属","Clamator":"凤头鹃属","Clanga":"乌雕属","Clangula":"长尾鸭属","Coccothraustes":"锡嘴雀属","Cochoa":"宽嘴鸫属","Coloeus":"寒鸦属","Columba":"鸽属","Conostoma":"红嘴鸦雀属","Copsychus":"鹊鸲属","Coracias":"佛法僧属","Coracina":"鸦鹃鵙属","Corvus":"鸦属","Coturnicops":"花田鸡属","Coturnix":"鹑属","Crex":"长脚秧鸡属","Crossoptilon":"马鸡属","Cuculus":"杜鹃属","Culicicapa":"方尾鹟属","Curruca":"林莺属","Cutia":"姬鹛属","Cyanistes":"蓝山雀属","Cyanoderma":"伪穗鹛属","Cyanopica":"灰喜鹊属","Cyanoptila":"蓝鹟属","Cygnus":"天鹅属","Cyornis":"仙鹟属","Cypsiurus":"棕雨燕属","Delichon":"毛脚燕属","Dendrocitta":"树鹊属","Dendrocopos":"啄木鸟属","Dendrocygna":"树鸭属","Dendronanthus":"山鹡鸰属","Dicaeum":"啄花鸟属","Dicrurus":"卷尾属","Dinopium":"金背三趾啄木鸟属","Dryobates":"林啄木鸟属","Dryocopus":"黑啄木鸟属","Ducula":"皇鸠属","Dupetor":"黑鳽属","Egretta":"白鹭属","Elachura":"丽星鹩鹛属","Elanus":"黑翅鸢属","Emberiza":"鹀属","Enicurus":"燕尾属","Eophona":"蜡嘴雀属","Eremophila":"角百灵属","Erithacus":"欧亚鸲属","Erpornis":"绿凤鹛属","Erythrogenys":"斑胸钩嘴鹛属","Erythropygia":"薮鸲属","Erythrura":"鹦雀属","Esacus":"大石鸻属","Estrilda":"梅花雀属","Eudromias":"小嘴鸻属","Eudynamys":"噪鹃属","Eumyias":"铜蓝鹟属","Euodice":"银嘴文鸟属","Eurynorhynchus":"勺嘴鹬属","Eurystomus":"三宝鸟属","Excalfactoria":"蓝胸鹑属","Falcipennis":"镰翅鸡属","Falco":"隼属","Ficedula":"姬鹟属","Francolinus":"鹧鸪属","Fregata":"军舰鸟属","Fringilla":"燕雀属","Fulica":"骨顶属","Fulmarus":"暴雪鹱属","Fulvetta":"褐鹛属","Galerida":"凤头百灵属","Gallicrex":"董鸡属","Gallinago":"沙锥属","Gallinula":"水鸡属","Gallirallus":"纹秧鸡属","Gallus":"原鸡属","Gampsorhynchus":"白头鵙鹛属","Garrulax":"噪鹛属","Garrulus":"松鸦属","Gavia":"潜鸟属","Gecinulus":"竹啄木鸟属","Gelochelidon":"噪鸥属","Geokichla":"少斑地鸫属","Geopelia":"姬地鸠属","Glareola":"燕鸻属","Glaucidium":"鸺鹠属","Gorsachius":"夜鳽属","Gracula":"鹩哥属","Gracupica":"斑椋鸟属","Graminicola":"大草莺属","Grammatoptila":"条纹噪鹛属","Grandala":"大翅鸲属","Grus":"鹤属","Gygis":"白玄鸥属","Gypaetus":"胡兀鹫属","Gyps":"兀鹫属","Gypsophila":"灰岩鹪鹛属","Haematopus":"蛎鹬属","Halcyon":"翡翠属","Haliaeetus":"海雕属","Haliastur":"栗鸢属","Harpactes":"咬鹃属","Helopsaltes":"小蝗莺属","Hemiprocne":"凤头雨燕属","Hemipus":"鹟鵙属","Hemitesia":"淡脚树莺属","Hemixos":"灰短脚鹎属","Heterophasia":"奇鹛属","Heteroxenicus":"栗背短翅鸫属","Hieraaetus":"隼雕属","Hierococcyx":"鹰鹃属","Himantopus":"长脚鹬属","Hirundapus":"针尾雨燕属","Hirundo":"燕属","Histrionicus":"丑鸭属","Hodgsonius":"短翅鸲属","Horornis":"山树莺属","Hydrobates":"海燕属","Hydrocoloeus":"小鸥属","Hydrophasianus":"水雉属","Hydroprogne":"巨鸥属","Hydrornis":"蓝八色鸫属","Hypogramma":"蓝枕花蜜鸟属","Hypothymis":"王鹟属","Hypsipetes":"短脚鹎属","Ianthocincla":"蓝噪鹛属","Ibidorhyncha":"鹮嘴鹬属","Ichthyaetus":"渔鸥属","Ictinaetus":"林雕属","Iduna":"靴篱莺属","Indicator":"响蜜䴕属","Iole":"伊俄勒短脚鹎属","Irena":"和平鸟属","Ithaginis":"血雉属","Ixobrychus":"苇鳽属","Ixos":"爱索斯短脚鹎属","Jabouilleia":"短尾鹛属","Jynx":"蚁䴕属","Ketupa":"渔鸮属","Kurochkinegramma":"蓝枕花蜜鸟属","Lagopus":"雷鸟属","Lalage":"鸣鹃鵙属","Lanius":"伯劳属","Larus":"鸥属","Larvivora":"鸲鸟属","Leiopicus":"褐额啄木鸟属","Leioptila":"栗背奇鹛属","Leiothrix":"相思鸟属","Leptopoecile":"雀莺属","Leptoptilos":"秃鹳属","Lerwa":"雪鹑属","Leucogeranus":"白鹤属","Leucophaeus":"豚鸥属","Leucosticte":"岭雀属","Lewinia":"灰胸秧鸡属","Limicola":"阔嘴鹬属","Limnodromus":"半蹼鹬属","Limosa":"塍鹬属","Linaria":"朱顶雀属","Liocichla":"薮鹛属","Lioparus":"金胸雀鹛属","Locustella":"蝗莺属","Lonchura":"文鸟属","Lophophanes":"冠山雀属","Lophophorus":"虹雉属","Lophotriorchis":"棕腹隼雕属","Lophura":"鹇属","Loriculus":"短尾鹦鹉属","Loxia":"交嘴雀属","Luscinia":"歌鸲属","Lymnocryptes":"姬鹬属","Lyncornis":"耳夜鹰属","Lyrurus":"琴鸡属","Machlolophus":"黄山雀属","Macronus":"褐纹胸鹛属","Macropygia":"鹃鸠属","Mareca":"亚鸭属","Marmaronetta":"云石斑鸭属","Megaceryle":"大鱼狗属","Megalaima":"拟啄木鸟属","Megalurus":"大尾莺属","Melanitta":"海番鸭属","Melanochlora":"冕雀属","Melanocorypha":"百灵属","Mergellus":"白秋沙鸭属","Mergus":"秋沙鸭属","Merops":"蜂虎属","Metopidius":"铜翅水雉属","Microcarbo":"小鸬鹚属","Microhierax":"小隼属","Micropternus":"栗啄木鸟属","Milvus":"鸢属","Minla":"希鹛属","Mirafra":"歌百灵属","Mixornis":"纹胸鹛属","Monticola":"矶鸫属","Montifringilla":"雪雀属","Motacilla":"鹡鸰属","Moupinia":"宝兴鹛雀属","Mulleripicus":"灰啄木鸟属","Muscicapa":"鹟属","Muscicapella":"侏蓝仙鹟属","Mycerobas":"拟蜡嘴雀属","Mycteria":"鹮鹳属","Myiomela":"蓝地鸲属","Myophonus":"啸鸫属","Myzornis":"火尾绿鹛属","Napothera":"鹪鹛属","Neophron":"白兀鹫属","Neosuthora":"短尾鸦雀属","Netta":"狭嘴濳鸭属","Nettapus":"棉凫属","Niltava":"蓝仙鹟属","Ninox":"鹰鸮属","Nipponia":"朱鹮属","Nisaetus":"亚洲鹰雕属","Nucifraga":"星鸦属","Numenius":"杓鹬属","Nycticorax":"夜鹭属","Nyctyornis":"夜蜂虎属","Oceanites":"南风暴海燕属","Oceanodroma":"叉尾海燕属","Oenanthe":"䳭属","Onychoprion":"棕背燕鸥属","Onychostruthus":"白腰雪雀属","Oriolus":"黄鹂属","Orthotomus":"缝叶莺属","Otis":"大鸨属","Otus":"角鸮属","Oxyura":"硬尾鸭属","Pandion":"鹗属","Panurus":"文须雀属","Paradoxornis":"鸦雀属","Parayuhina":"白领凤鹛属","Pardaliparus":"黄腹山雀属","Parus":"山雀属","Passer":"麻雀属","Passerculus":"草鹀属","Pastor":"粉红椋鸟属","Pavo":"孔雀属","Pelargopsis":"鹳嘴翡翠属","Pelecanus":"鹈鹕属","Pellorneum":"幽鹛属","Perdix":"山鹑属","Pericrocotus":"山椒鸟属","Periparus":"黑冠山雀属","Perisoreus":"噪鸦属","Pernis":"蜂鹰属","Petrochelidon":"石燕属","Petronia":"石雀属","Phaenicophaeus":"地鹃属","Phaethon":"鹲属","Phalacrocorax":"鸬鹚属","Phalaropus":"瓣蹼鹬属","Phasianus":"雉属","Philomachus":"流苏鹬属","Phodilus":"栗鸮属","Phoebastria":"北太平洋信天翁属","Phoenicopterus":"红鹳属","Phoenicurus":"红尾鸲属","Phyllergates":"拟缝叶莺属","Phylloscopus":"柳莺属","Pica":"喜鹊属","Picoides":"三趾啄木鸟属","Picumnus":"姬啄木鸟属","Picus":"绿啄木鸟属","Pinicola":"松雀属","Pitta":"八色鸫属","Platalea":"琵鹭属","Plectrophenax":"雪鹀属","Plegadis":"彩鹮属","Ploceus":"织布鸟属","Pluvialis":"金鸻属","Pnoepyga":"鹪鹛属","Podiceps":"䴙䴘属","Podoces":"地鸦属","Poecile":"高山山雀属","Polyplectron":"孔雀雉属","Polysticta":"小绒鸭属","Pomatorhinus":"钩嘴鹛属","Porphyrio":"紫水鸡属","Porzana":"田鸡属","Prinia":"鹪莺属","Procarduelis":"暗胸朱雀属","Prunella":"岩鹨属","Psarisomus":"长尾阔嘴鸟属","Pseudibis":"黑鹮属","Pseudobulweria":"拟燕鹱属","Pseudopodoces":"地山雀属","Psilopogon":"拟啄木鸟属","Psittacula":"鹦鹉属","Psittinus":"蓝腰鹦鹉属","Psittiparus":"白胸鸦雀属","Pterocles":"沙鸡属","Pterodroma":"圆尾鹱属","Pterorhinus":"黑喉噪鹛属","Pteruthius":"鵙鹛属","Ptilinopus":"果鸠属","Ptyonoprogne":"岩燕属","Pucrasia":"勺鸡属","Puffinus":"剪水鹱属","Pycnonotus":"鹎属","Pyrgilauda":"黑喉雪雀属","Pyrrhocorax":"山鸦属","Pyrrhoplectes":"金枕黑雀属","Pyrrhula":"灰雀属","Rallina":"斑秧鸡属","Rallus":"秧鸡属","Recurvirostra":"反嘴鹬属","Regulus":"戴菊属","Remiz":"攀雀属","Rhinomyias":"林鹟属","Rhipidura":"扇尾鹟属","Rhodopechys":"沙雀属","Rhodospiza":"沙雀属","Rhodostethia":"楔尾鸥属","Rhopophilus":"山鹛属","Rhyacornis":"水鸲属","Rhyticeros":"拟皱盔犀鸟属","Rimator":"长嘴鹩鹛属","Riparia":"沙燕属","Rissa":"三趾鸥属","Rostratula":"彩鹬属","Rubigula":"黄鹎属","Rynchops":"剪嘴鸥属","Sarcogyps":"黑兀鹫属","Sarkidiornis":"瘤鸭属","Saroglossa":"斑翅椋鸟属","Sasia":"棕啄木鸟属","Saundersilarus":"黑嘴鸥属","Saxicola":"石䳭属","Schoeniparus":"拟希鹛属","Scolopax":"丘鹬属","Seicercus":"鹟莺属","Serilophus":"先丝冠鸟属","Serinus":"丝雀属","Sibirionetta":"花脸鸭属","Sinosuthora":"棕头鸦雀属","Sitta":"䴓属","Sittiparus":"杂色山雀属","Spatula":"匙嘴鸭属","Spelaeornis":"鹩鹛属","Sphenocichla":"楔嘴鹩鹛属","Spilopelia":"副斑鸠属","Spilornis":"蛇雕属","Spinus":"金雀属","Spizixos":"雀嘴鹎属","Spodiopsar":"丝光椋鸟属","Stachyridopsis":"红头穗鹛属","Stachyris":"穗鹛属","Staphida":"栗凤鹛属","Stercorarius":"贼鸥属","Sterna":"燕鸥属","Sternula":"小燕鸥属","Streptopelia":"斑鸠属","Strix":"林鸮属","Sturnia":"亚洲椋鸟属","Sturnus":"椋鸟属","Sula":"鲣鸟属","Surnia":"猛鸮属","Surniculus":"乌鹃属","Suthora":"金色鸦雀属","Sylvia":"典型莺属","Sylviparus":"黄眉林雀属","Synoicus":"蓝鹑属","Synthliboramphus":"扁嘴海雀属","Syrmaticus":"长尾雉属","Syrrhaptes":"毛腿沙鸡属","Tachybaptus":"小䴙䴘属","Tachymarptis":"高山雨燕属","Tadorna":"麻鸭属","Tarsiger":"鸲属","Temnurus":"塔尾树鹊属","Tephrodornis":"林鵙属","Terpsiphone":"寿带属","Tesia":"地莺属","Tetrao":"松鸡属","Tetraogallus":"雪鸡属","Tetraophasis":"雉鹑属","Tetrastes":"榛鸡属","Tetrax":"小鸨属","Thalasseus":"凤头燕鸥属","Threskiornis":"鹮属","Tichodroma":"旋壁雀属","Tickellia":"宽嘴鹟莺属","Timalia":"鹛属","Todiramphus":"领翡翠属","Tragopan":"角雉属","Treron":"绿鸠属","Tringa":"鹬属","Trochalopteron":"圆翅噪鹛属","Troglodytes":"鹪鹩属","Tropicoperdix":"树鹧鸪属","Tryngites":"饰胸鹬属","Turdus":"鸫属","Turnix":"三趾鹑属","Tyto":"草鸮属","Upupa":"戴胜属","Uria":"海鸦属","Urocissa":"蓝鹊属","Urocynchramus":"朱鹀属","Urosphena":"短尾莺属","Vanellus":"麦鸡属","Xema":"叉尾鸥属","Xenus":"翘嘴鹬属","Yuhina":"凤鹛属","Zapornia":"小田鸡属","Zonotrichia":"带鹀属","Zoothera":"地鸫属","Zosterops":"绣眼鸟属"},"orders":{"䳍形目":"Tinamiformes","䴕形目":"Piciformes","䴙䴘目":"Podicipediformes","企鹅目":"Sphenisciformes","佛法僧目":"Coraciiformes","叫鹤目":"Cariamiformes","咬鹃目":"Trogoniformes","夜鹰目":"Caprimulgiformes","拟鹑目":"Mesitornithiformes","无翼鸟目":"Apterygiformes","日鳽目":"Eurypygiformes","林鸱目":"Nyctibiiformes","沙鸡目":"Pterocliformes","油鸱目":"Steatornithiformes","潜鸟目":"Gaviiformes","犀鸟目":"Bucerotiformes","红鹳目":"Phoenicopteriformes","美洲鸵目":"Rheiformes","蕉鹃目":"Musophagiformes","蟆口鸱目":"Podargiformes","裸鼻夜鹰目":"Aegotheliformes","隼形目":"Falconiformes","雀形目":"Passeriformes","雁形目":"Anseriformes","雨燕目":"Apodiformes","鲣鸟目":"Suliformes","鸡形目":"Galliformes","鸨形目":"Otidiformes","鸮形目":"Strigiformes","鸵鸟目":"Struthioniformes","鸻形目":"Charadriiformes","鸽形目":"Columbiformes","鹃形目":"Cuculiformes","鹃鴗目":"Leptosomiformes","鹈形目":"Pelecaniformes","鹤形目":"Gruiformes","鹤鸵目":"Casuariiformes","鹦形目":"Psittaciformes","鹰形目":"Accipitriformes","鹱形目":"Procellariiformes","鹲形目":"Phaethontiformes","鹳形目":"Ciconiiformes","麝雉目":"Opisthocomiformes","鼠鸟目":"Coliiformes","啄木鸟目":"Piciformes","鹦鹉目":"Psittaciformes"},"families":{"䳍鸟科":"Tinamidae","䴙䴘科":"Podicipedidae","三趾鹑科":"Turnicidae","丛鵙科":"Malaconotidae","企鹅科":"Spheniscidae","伞鸟科":"Cotingidae","伯勞科":"Laniidae","佛法僧科":"Coraciidae","侏儒鸟科":"Pipridae","信天翁科":"Diomedeidae","八色鸫科":"Pittidae","军舰鸟科":"Fregatidae","冠鹩鸫科":"Zeledoniidae","冢雉科":"Megapodiidae","凤冠雉科":"Cracidae","凤头雨燕科":"Hemiprocnidae","凤头鹦鹉科":"Cacatuidae","刺嘴莺科":"Acanthizidae","刺莺科":"Dasyornithidae","刺鹩科":"Acanthisittidae","卷尾科":"Dicruridae","叫鸭科":"Anhimidae","叶鹎科":"Chloropseidae","吸蜜鸟科":"Meliphagidae","咬鹃科":"Trogonidae","啄木鸟科":"Picidae","啄花鸟科":"Dicaeidae","啸鹟科":"Pachycephalidae","喇叭鸟科":"Psophiidae","喉䳭科":"Modulatricidae","嘲鸫科":"Mimidae","噪鹛科":"Leiothrichidae","园丁鸟科":"Ptilonorhynchidae","夜鹰科":"Caprimulgidae","太平鸟科":"Bombycillidae","山雀科":"Paridae","岩鹛科":"Picathartidae","岩鹨科":"Prunellidae","弯嘴鹛科":"Pomatostomidae","彩鹬科":"Rostratulidae","戴勝科":"Upupidae","戴菊科":"Regulidae","扇尾莺科":"Cisticolidae","扇尾鹟科":"Rhipiduridae","拟鸦科":"Corcoracidae","拟黄鹂科":"Icteridae","攀雀科":"Remizidae","文须雀科":"Panuridae","斑食蜜鸟科":"Pardalotidae","斗鹎科":"Nicatoridae","新大陆禿鹫":"Cathartidae","旋壁雀科":"Tichodromidae","旋木雀科":"Certhiidae","无翼鸟科":"Apterygidae","日䴘科":"Heliornithidae","旧世界鹦鹉科":"Psittaculidae","木鸫科":"Orthonychidae","朱鹀科":"Urocynchramidae","朱鹭科":"Threskiornithidae","杜鹃科":"Cuculidae","极樂鸟科":"Paradisaeidae","柳莺科":"Phylloscopidae","树莺科":"Cettiidae","梅花雀科":"Estrildidae","森莺科":"Parulidae","椋鸟科":"Sturnidae","沙鸡科":"Pteroclidae","河乌科":"Cinclidae","海燕科":"Hydrobatidae","海雀科":"Alcidae","潛鸟科":"Gaviidae","澳䳭科":"Promeropidae","澳鳾科":"Neosittidae","灰連雀科":"Hypocoliidae","灶鸟科":"Furnariidae","燕科":"Hirundinidae","燕鵙科":"Artamidae","燕鸻科":"Glareolidae","牛椋鸟科":"Buphagidae","犀鸟科":"Bucerotidae","王鹟科":"Monarchidae","玫瑰鸫科":"Rhodinocichlidae","琴鸟科":"Menuridae","画眉科":"Timaliidae","百灵科":"Alaudidae","皇霸鹟科":"Onychorhynchidae","短嘴旋木雀科":"Climacteridae","石鸻科":"Burhinidae","秧鸡科":"Rallidae","秧鹤科":"Aramidae","籽鹬科":"Thinocoridae","繡眼科":"Zosteropidae","红鹟科":"Erythrocercidae","红鹤科":"Phoenicopteridae","纹鹪莺科":"Scotocercidae","织布鸟科":"Ploceidae","维达鸟科":"Viduidae","绿鹃科":"Vireonidae","缝叶吸蜜鸟科":"Notiomystidae","美洲雀科":"Cardinalidae","美洲鸵鸟科":"Rheidae","翠鸟科":"Alcedinidae","花蜜鸟科":"Nectariniidae","苇莺科":"Acrocephalidae","草鸮科":"Tytonidae","莺科":"Sylviidae","莺鹟科":"Stenostiridae","蕉鹃科":"Musophagidae","藪鸟科":"Atrichornithidae","蚁鵙科":"Thamnophilidae","蚁鸫科":"Formicariidae","蚋莺科":"Polioptilidae","蛇鹈科":"Anhingidae","蜂虎科":"Meropidae","蜂鸟科":"Trochilidae","蝗莺科":"Locustellidae","蠣鹬":"Haematopodidae","裸眉鸫科":"Philepittidae","裸鼻雀科":"Thraupidae","賊鸥科":"Stercorariidae","鎚头鹳科":"Scopidae","钩嘴鵙科":"Vangidae","铁爪鹀科":"Calcariidae","长嘴莺科":"Macrosphenidae","长尾山雀科":"Aegithalidae","长脚鹬科":"Recurvirostridae","阔嘴霸鹟科":"Sapayoidae","阔嘴鸟科":"Eurylaimidae","隼科":"Falconidae","雀眉科":"Pellorneidae","雀科":"Passerellidae","雀鹎科":"Aegithinidae","雉科":"Phasianidae","雉鸻科":"Jacanidae","雨燕科":"Apodidae","霸鹟科":"Tyrannidae","须䴕科":"Megalaimidae","食蚊鸟科":"Conopophagidae","马岛莺科":"Bernieridae","鲣鸟科":"Sulidae","鲸头鹳科":"Balaenicipitidae","鳞胸鹪鹛科":"Pnoepygidae","鳾科":"Sittidae","鸠鸽科":"Columbidae","鸥科":"Laridae","鸦科":"Corvidae","鸨科":"Otididae","鸫科":"Turdidae","鸬鹚科":"Phalacrocoracidae","鸭科":"Anatidae","鸱鸮科":"Strigidae","鸲鹟科":"Petroicidae","鸵鸟科":"Struthionidae","鸻科":"Charadriidae","鹀科":"Emberizidae","鹃鵙科":"Campephagidae","鹈鶘科":"Pelecanidae","鹎科":"Pycnonotidae","鹗科":"Pandionidae","鹟科":"Muscicapidae","鹡鸰科":"Motacillidae","鹤科":"Gruidae","鹤鸵科":"Casuariidae","鹦嘴科":"Paradoxornithidae","鹦鹉科":"Psittacidae","鹩莺科":"Maluridae","鹪鹩科":"Troglodytidae","鹬科":"Scolopacidae","鹭科":"Ardeidae","鹰科":"Accipitridae","鹱科":"Procellariidae","鹳科":"Ciconiidae","麻雀科":"Passeridae","黄鹂科":"Oriolidae","黑顶鹪鹩科":"Donacobiidae","鼠鸟科":"Rhinocryptidae","𱉻𱊊科":"Ramphastidae","䴓科":"Sittidae","丘鹬科":"Scolopacidae","丽星鹩鹛科":"Elachuridae","仓鸮科":"Tytonidae","仙莺科":"Stenostiridae","伯劳科":"Laniidae","南海燕科":"Oceanitidae","反嘴鹬科":"Recurvirostridae","和平鸟科":"Irenidae","响蜜䴕科":"Indicatoridae","响蜜鴷科":"Indicatoridae","太阳鸟科":"Nectariniidae","山椒鸟科":"Campephagidae","幽鹛科":"Pellorneidae","戴胜科":"Upupidae","拟啄木鸟科":"Megalaimidae","林鵙科":"Vangidae","林鹛科":"Timaliidae","树燕科":"Hemiprocnidae","水雉科":"Jacanidae","潜鸟科":"Gaviidae","燕雀科":"Fringillidae","玉鹟科":"Hyliotidae","短翅莺科":"Locustellidae","红鹳科":"Phoenicopteridae","织雀科":"Ploceidae","绣眼鸟科":"Zosteropidae","莺雀科":"Vireonidae","莺鹛科":"Sylviidae","蛎鹬科":"Haematopodidae","蛙口夜鹰科":"Podargidae","蟆口鸱科":"Podargidae","贼鸥科":"Stercorariidae","雀鹀科":"Passerellidae","雀鹛科":"Alcippeidae","鞘嘴鸥科":"Chionidae","鸦雀科":"Paradoxornithidae","鹈鹕科":"Pelecanidae","鹛科":"Timaliidae","鹮嘴鹬科":"Ibidorhynchidae","鹮科":"Threskiornithidae","鹲科":"Phaethontidae"}};

  // =========================================================================
  // 1. Utility & Taxonomy Helpers
  // =========================================================================

  function safeStr(v) {
    if (v === null || v === undefined) return '';
    return String(v).trim();
  }

  function normalizeTime(t) {
    const s = safeStr(t);
    if (!s) return '';
    return s.replace(/\//g, '-');
  }

  function datePart(t) {
    const s = normalizeTime(t);
    return s.length >= 10 ? s.slice(0, 10) : s;
  }

  function splitLatinName(latin) {
    const clean = safeStr(latin).replace(/\s+/g, ' ');
    if (!clean) return { genusLatin: '', speciesEpithet: '' };
    const parts = clean.split(' ');
    return {
      genusLatin: parts[0] || '',
      speciesEpithet: parts.slice(1).join(' '),
    };
  }

  function enrichTaxonomy(item, taxonById, taxonByName, groupById, groupByName, dict) {
    const activeDict = dict || TAXONOMY_DICT;
    const tid = safeStr(item.taxon_id || item.id);
    const tname = safeStr(item.taxon_name || item.name);

    const refZ4 = (tid && taxonById.get(tid)) || (tname && taxonByName.get(tname)) || {};
    const refGrp = (tid && groupById.get(tid)) || (tname && groupByName.get(tname)) || {};

    const taxonId = tid || safeStr(refZ4.id || refGrp.taxon_id);
    const taxonName = tname || safeStr(refZ4.name || refGrp.taxon_name);
    const latinName = safeStr(item.latinname || refGrp.latinname || refZ4.latinname);
    const englishName = safeStr(item.englishname || refGrp.englishname || refZ4.englishname);
    const orderZh = safeStr(item.taxonordername || refGrp.taxonordername || refZ4.taxonordername);
    const familyZh = safeStr(item.taxonfamilyname || refGrp.taxonfamilyname || refZ4.taxonfamilyname);
    const chinaLevel = safeStr(item.china_level || refGrp.china_level || refZ4.china_level);
    const iucn = safeStr(item.iucn || refGrp.iucn || refZ4.iucn);
    const cites = safeStr(item.cites || refGrp.cites || refZ4.cites);

    const { genusLatin, speciesEpithet } = splitLatinName(latinName);
    const orderLatin = (activeDict.orders && activeDict.orders[orderZh]) || '';
    const familyLatin = (activeDict.families && activeDict.families[familyZh]) || '';
    const genusZh = (activeDict.genera && activeDict.genera[genusLatin]) || '';

    return {
      taxonId,
      taxonName,
      latinName,
      englishName,
      orderZh,
      orderLatin,
      familyZh,
      familyLatin,
      genusZh,
      genusLatin,
      speciesEpithet,
      chinaLevel,
      iucn,
      cites,
    };
  }

  function formatLocation(rec) {
    const prov = safeStr(rec.province_name);
    const city = safeStr(rec.city_name);
    const dist = safeStr(rec.district_name);
    const point = safeStr(rec.point_name);

    const adminParts = [];
    if (prov) adminParts.push(prov);
    if (city && city !== prov) adminParts.push(city);
    if (dist && dist !== city) adminParts.push(dist);

    const adminStr = adminParts.join(' ');
    let fullLocation = adminStr;
    if (point) {
      fullLocation = adminStr
        ? (point.startsWith(adminParts[0]) ? point : `${adminStr} - ${point}`)
        : point;
    }

    return {
      province: prov,
      city,
      district: dist,
      pointName: point || adminParts.join(''),
      fullLocation: fullLocation || '-',
    };
  }

  function formatRecordType(rec) {
    if (Number(rec.data_type) === 1) return '定点记';
    if (rec.media_type === 'IMAGE') return '图片记';
    if (rec.media_type === 'VOICE') return '声音记';
    return '随手记';
  }

  function formatOutsideStatus(rec) {
    if (Number(rec.outside_type) !== 1) return '正常';
    if (Number(rec.checker) === 1) return '分布外(已复核通过)';
    if (Number(rec.escaped) === 1) return '逸出/笼养逃逸';
    return '分布外/待核验';
  }

  function parseTimelineRanks(timelineData) {
    const entries = [];
    const list = Array.isArray(timelineData) ? timelineData : [];
    for (const dayItem of list) {
      const day = datePart(dayItem.start_time);
      const rawNames = safeStr(dayItem.taxon_names);
      if (!rawNames) continue;
      const parts = rawNames.split(',');
      for (const p of parts) {
        const name = p.replace(/\[.*$/, '').trim();
        if (name) entries.push({ day, name });
      }
    }
    entries.reverse();
    const rankByName = new Map();
    entries.forEach((e, idx) => {
      if (!rankByName.has(e.name)) {
        rankByName.set(e.name, { rank: idx + 1, day: e.day });
      }
    });
    return rankByName;
  }

  function compareTimeAsc(a, b) {
    const ta = normalizeTime(a);
    const tb = normalizeTime(b);
    if (!ta && !tb) return 0;
    if (!ta) return 1;
    if (!tb) return -1;
    return ta < tb ? -1 : ta > tb ? 1 : 0;
  }

  function recordCompositeKey(r) {
    // Note: in member/system/record/taxon, `r.id` is the report/activity_id (shared across all species in one report),
    // NOT a unique sighting row ID. Never deduplicate by `r.id` alone.
    return [
      safeStr(r.record_id),
      safeStr(r.id),
      safeStr(r.serial_id),
      safeStr(r.taxon_id),
      safeStr(r.taxon_name),
      safeStr(r.start_time),
      safeStr(r.end_time),
      safeStr(r.taxon_count),
      safeStr(r.point_name),
      safeStr(r.ctime),
    ].join('|');
  }

  function dedupeRecords(records) {
    // Only drop exact cross-page duplicates; preserve legitimate repeated rows within the same page.
    const seen = new Set();
    const out = [];
    for (const r of records) {
      const baseKey = recordCompositeKey(r);
      const pageTag = r._pageOccurrence ? `#${r._pageOccurrence}` : '';
      const key = baseKey + pageTag;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(r);
    }
    return out;
  }

  // =========================================================================
  // 2. Core Data Merging, Report Aggregation & Timeline Construction
  // =========================================================================

  function buildExportDataset({
    account = '',
    z4TaxonList = [],
    groupBirds = [],
    outsideGroupBirds = [],
    timelineData = [],
    allRecords = [],
    sortOrder = 'asc',
    includeOutside = false,
    taxonomyDict = TAXONOMY_DICT,
  }) {
    const taxonById = new Map();
    const taxonByName = new Map();
    for (const t of z4TaxonList) {
      if (t.id !== undefined && t.id !== null) taxonById.set(String(t.id), t);
      if (t.name) taxonByName.set(String(t.name).trim(), t);
    }

    const combinedGroups = [];
    for (const g of groupBirds) {
      combinedGroups.push({ ...g, _checklistScope: '郑四名录内' });
    }
    if (includeOutside) {
      const existingIds = new Set(groupBirds.map((g) => safeStr(g.taxon_id)));
      for (const g of outsideGroupBirds) {
        if (!existingIds.has(safeStr(g.taxon_id))) {
          combinedGroups.push({ ...g, _checklistScope: '名录外/分布外' });
        }
      }
    }

    const groupById = new Map();
    const groupByName = new Map();
    for (const g of combinedGroups) {
      if (g.taxon_id !== undefined && g.taxon_id !== null) groupById.set(String(g.taxon_id), g);
      if (g.taxon_name) groupByName.set(String(g.taxon_name).trim(), g);
    }

    const timelineRankByName = parseTimelineRanks(timelineData);
    const uniqueRecords = dedupeRecords(allRecords);

    // Filter records if not including outside
    const filteredRecords = includeOutside
      ? uniqueRecords
      : uniqueRecords.filter((r) => Number(r.outside_type) !== 1 || Number(r.checker) === 1);

    // Index ALL filtered records by taxon_id AND taxon_name so no sighting is missed
    const recordsByTaxonId = new Map();
    const recordsByTaxonName = new Map();

    const addToBucket = (map, key, rec) => {
      if (!key) return;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(rec);
    };

    for (const r of filteredRecords) {
      addToBucket(recordsByTaxonId, safeStr(r.taxon_id), r);
      addToBucket(recordsByTaxonName, safeStr(r.taxon_name), r);
    }

    const sortRecsChrono = (arr) =>
      arr.slice().sort((a, b) => {
        const c1 = compareTimeAsc(a.start_time, b.start_time);
        if (c1 !== 0) return c1;
        const c2 = compareTimeAsc(a.ctime, b.ctime);
        if (c2 !== 0) return c2;
        return safeStr(a.serial_id).localeCompare(safeStr(b.serial_id));
      });

    // Build master species list (prefer combinedGroups; fallback to records if API returned empty)
    const masterSpeciesSource = combinedGroups.length > 0 ? combinedGroups : [];
    const seenSpeciesKeys = new Set();
    const speciesCandidates = [];

    for (const g of masterSpeciesSource) {
      const tid = safeStr(g.taxon_id);
      const tname = safeStr(g.taxon_name);
      const spKey = tid ? `id:${tid}` : `name:${tname}`;
      if (seenSpeciesKeys.has(spKey)) continue;
      seenSpeciesKeys.add(spKey);
      speciesCandidates.push({ group: g, tid, tname });
    }

    if (masterSpeciesSource.length === 0) {
      for (const r of filteredRecords) {
        const tid = safeStr(r.taxon_id);
        const tname = safeStr(r.taxon_name);
        const spKey = tid ? `id:${tid}` : `name:${tname}`;
        if (seenSpeciesKeys.has(spKey)) continue;
        seenSpeciesKeys.add(spKey);
        speciesCandidates.push({
          group: {
            taxon_id: tid,
            taxon_name: tname,
            latinname: r.latinname,
            englishname: r.englishname,
            _checklistScope: Number(r.outside_type) === 1 ? '名录外/分布外' : '郑四名录内',
          },
          tid,
          tname,
        });
      }
    }

    const firstRecordRefs = new Set();

    const timelineItems = speciesCandidates.map(({ group, tid, tname }) => {
      const tax = enrichTaxonomy(group, taxonById, taxonByName, groupById, groupByName, taxonomyDict);

      // Union records matched by taxon_id or taxon_name (covers G3->Z4 ID shifts)
      const matchedSet = new Set();
      for (const k of [tid, tax.taxonId]) {
        if (k && recordsByTaxonId.has(k)) {
          for (const rec of recordsByTaxonId.get(k)) matchedSet.add(rec);
        }
      }
      for (const k of [tname, tax.taxonName]) {
        if (k && recordsByTaxonName.has(k)) {
          for (const rec of recordsByTaxonName.get(k)) matchedSet.add(rec);
        }
      }

      const sortedRecs = sortRecsChrono(Array.from(matchedSet));
      const firstRec = sortedRecs[0] || null;
      if (firstRec) firstRecordRefs.add(firstRec);

      const firstLoc = firstRec
        ? formatLocation(firstRec)
        : { province: '', city: '', district: '', pointName: '', fullLocation: '' };

      const uniqueLocs = [];
      const locSet = new Set();
      let totalIndividualCount = 0;
      for (const rec of sortedRecs) {
        const fl = formatLocation(rec).fullLocation;
        if (fl && fl !== '-' && !locSet.has(fl)) {
          locSet.add(fl);
          uniqueLocs.push(fl);
        }
        const cnt = Number(rec.taxon_count);
        if (!Number.isNaN(cnt) && cnt > 0) totalIndividualCount += cnt;
      }

      const tlInfo = timelineRankByName.get(tax.taxonName) || null;
      const recEarliest = normalizeTime(firstRec && firstRec.start_time);
      const grpEarliest = normalizeTime(group.earlist_time);
      // Prefer the earliest valid timestamp between matched sighting and official group earlist_time
      let firstTime = recEarliest || grpEarliest || (tlInfo && tlInfo.day) || '';
      if (recEarliest && grpEarliest && compareTimeAsc(grpEarliest, recEarliest) < 0) {
        firstTime = grpEarliest;
      }
      const firstDate = datePart(firstTime);

      return {
        _firstTime: firstTime,
        _timelineRank: tlInfo ? tlInfo.rank : Number.MAX_SAFE_INTEGER,
        _taxonIdNum: Number(tax.taxonId) || Number.MAX_SAFE_INTEGER,
        firstSeq: 0,
        firstDate,
        firstTime,
        taxonId: tax.taxonId,
        taxonName: tax.taxonName,
        latinName: tax.latinName,
        englishName: tax.englishName,
        orderZh: tax.orderZh,
        orderLatin: tax.orderLatin,
        familyZh: tax.familyZh,
        familyLatin: tax.familyLatin,
        genusZh: tax.genusZh,
        genusLatin: tax.genusLatin,
        speciesEpithet: tax.speciesEpithet,
        firstProvince: firstLoc.province,
        firstCity: firstLoc.city,
        firstDistrict: firstLoc.district,
        firstPointName: firstLoc.pointName,
        firstFullLocation: firstLoc.fullLocation,
        firstCount: firstRec ? (firstRec.taxon_count ?? '') : '',
        firstSerialId: firstRec ? safeStr(firstRec.serial_id) : '',
        firstRecordType: firstRec ? formatRecordType(firstRec) : '',
        recordNum: Math.max(Number(group.record_num) || 0, sortedRecs.length),
        totalIndividualCount: totalIndividualCount || '',
        allLocationsCount: uniqueLocs.length,
        allLocations: uniqueLocs.join('；'),
        chinaLevel: tax.chinaLevel,
        iucn: tax.iucn,
        cites: tax.cites,
        checklistScope: group._checklistScope || '郑四名录内',
      };
    });

    // Always sort ascending first to assign true chronological 首加序号 (1 = lifetime first species)
    timelineItems.sort((a, b) => {
      const cDay = compareTimeAsc(a.firstDate, b.firstDate);
      if (cDay !== 0) return cDay;
      if (a._timelineRank !== b._timelineRank) return a._timelineRank - b._timelineRank;
      const cTime = compareTimeAsc(a._firstTime, b._firstTime);
      if (cTime !== 0) return cTime;
      return a._taxonIdNum - b._taxonIdNum;
    });

    timelineItems.forEach((item, idx) => {
      item.firstSeq = idx + 1;
    });

    const orderedTimeline = sortOrder === 'desc' ? timelineItems.slice().reverse() : timelineItems;

    // Sheet 2: Full raw observation records (all 600+ rows preserved)
    const sortedAllRecords = filteredRecords.slice().sort((a, b) => {
      const cmp = compareTimeAsc(a.start_time, b.start_time);
      if (cmp !== 0) return sortOrder === 'desc' ? -cmp : cmp;
      return safeStr(a.serial_id).localeCompare(safeStr(b.serial_id));
    });

    const enrichedRecords = sortedAllRecords.map((rec, idx) => {
      const tax = enrichTaxonomy(rec, taxonById, taxonByName, groupById, groupByName, taxonomyDict);
      const loc = formatLocation(rec);
      return {
        seq: idx + 1,
        startTime: normalizeTime(rec.start_time),
        endTime: normalizeTime(rec.end_time),
        obsDate: datePart(rec.start_time),
        isFirstAddition: firstRecordRefs.has(rec) ? '是' : '否',
        taxonId: tax.taxonId,
        taxonName: tax.taxonName,
        latinName: tax.latinName,
        englishName: tax.englishName,
        orderZh: tax.orderZh,
        orderLatin: tax.orderLatin,
        familyZh: tax.familyZh,
        familyLatin: tax.familyLatin,
        genusZh: tax.genusZh,
        genusLatin: tax.genusLatin,
        taxonCount: rec.taxon_count ?? '',
        province: loc.province,
        city: loc.city,
        district: loc.district,
        pointName: loc.pointName,
        fullLocation: loc.fullLocation,
        recordType: formatRecordType(rec),
        serialId: safeStr(rec.serial_id),
        status: formatOutsideStatus(rec),
        chinaLevel: tax.chinaLevel,
        iucn: tax.iucn,
        ctime: normalizeTime(rec.ctime),
      };
    });

    // Sheet 3: Report / Trip summary (grouped by serial_id or activity id)
    const reportMap = new Map();
    for (const rec of sortedAllRecords) {
      const rKey = safeStr(rec.serial_id) || safeStr(rec.id) || `anon:${normalizeTime(rec.start_time)}|${safeStr(rec.point_name)}`;
      if (!reportMap.has(rKey)) {
        const loc = formatLocation(rec);
        reportMap.set(rKey, {
          serialId: safeStr(rec.serial_id) || safeStr(rec.id),
          obsDate: datePart(rec.start_time),
          startTime: normalizeTime(rec.start_time),
          endTime: normalizeTime(rec.end_time),
          province: loc.province,
          city: loc.city,
          district: loc.district,
          pointName: loc.pointName,
          fullLocation: loc.fullLocation,
          recordType: formatRecordType(rec),
          speciesSet: new Set(),
          speciesList: [],
          firstAddedSet: new Set(),
          rowCount: 0,
          totalCount: 0,
        });
      }
      const rep = reportMap.get(rKey);
      rep.rowCount += 1;
      const cnt = Number(rec.taxon_count);
      if (!Number.isNaN(cnt) && cnt > 0) rep.totalCount += cnt;
      const spName = safeStr(rec.taxon_name);
      if (spName && !rep.speciesSet.has(spName)) {
        rep.speciesSet.add(spName);
        rep.speciesList.push(spName);
      }
      if (firstRecordRefs.has(rec) && spName) {
        rep.firstAddedSet.add(spName);
      }
    }

    const reports = Array.from(reportMap.values())
      .sort((a, b) => {
        const cmp = compareTimeAsc(a.startTime, b.startTime);
        return sortOrder === 'desc' ? -cmp : cmp;
      })
      .map((rep, idx) => ({
        seq: idx + 1,
        serialId: rep.serialId,
        obsDate: rep.obsDate,
        startTime: rep.startTime,
        endTime: rep.endTime,
        province: rep.province,
        city: rep.city,
        district: rep.district,
        pointName: rep.pointName,
        fullLocation: rep.fullLocation,
        recordType: rep.recordType,
        speciesCount: rep.speciesSet.size,
        newSpeciesCount: rep.firstAddedSet.size,
        rowCount: rep.rowCount,
        totalCount: rep.totalCount || '',
        speciesNames: rep.speciesList.join('、'),
      }));

    // Sheet 4: Overview statistics
    const orderSet = new Set(timelineItems.map((x) => x.orderZh).filter(Boolean));
    const familySet = new Set(timelineItems.map((x) => x.familyZh).filter(Boolean));
    const genusSet = new Set(timelineItems.map((x) => x.genusLatin).filter(Boolean));

    const yearNewSpecies = new Map();
    const yearRecords = new Map();
    const provNewSpecies = new Map();

    for (const sp of timelineItems) {
      const y = sp.firstDate ? sp.firstDate.slice(0, 4) : '未知年份';
      yearNewSpecies.set(y, (yearNewSpecies.get(y) || 0) + 1);
      const p = sp.firstProvince || '未知省份';
      provNewSpecies.set(p, (provNewSpecies.get(p) || 0) + 1);
    }
    for (const rec of enrichedRecords) {
      const y = rec.obsDate ? rec.obsDate.slice(0, 4) : '未知年份';
      yearRecords.set(y, (yearRecords.get(y) || 0) + 1);
    }

    const yearsSorted = Array.from(new Set([...yearNewSpecies.keys(), ...yearRecords.keys()])).sort();
    const provsSorted = Array.from(provNewSpecies.entries()).sort((a, b) => b[1] - a[1]);

    const summary = {
      account: account || '-',
      exportTime: new Date().toLocaleString('zh-CN', { hour12: false }),
      taxonomyVersion: '《中国鸟类分类与分布名录（第四版）》（郑四版 CH4）',
      totalOrders: orderSet.size,
      totalFamilies: familySet.size,
      totalGenera: genusSet.size,
      totalSpecies: timelineItems.length,
      totalReports: reports.length,
      totalRecords: enrichedRecords.length,
      matchedLocationSpecies: timelineItems.filter((x) => x.firstFullLocation).length,
      years: yearsSorted.map((y) => ({
        year: y,
        newSpecies: yearNewSpecies.get(y) || 0,
        records: yearRecords.get(y) || 0,
      })),
      provinces: provsSorted.map(([prov, cnt]) => ({ province: prov, firstSpeciesCount: cnt })),
    };

    return {
      speciesTimeline: orderedTimeline,
      records: enrichedRecords,
      reports,
      summary,
    };
  }

  // =========================================================================
  // 3. Table Column Definitions
  // =========================================================================

  const SPECIES_COLUMNS = [
    { key: 'firstSeq', header: '首加序号', type: 'number', width: 10 },
    { key: 'firstDate', header: '首次记录日期', width: 14 },
    { key: 'firstTime', header: '首次观测时间', width: 20 },
    { key: 'taxonName', header: '中文名(种)', width: 16 },
    { key: 'latinName', header: '拉丁学名', width: 26, italic: true },
    { key: 'englishName', header: '英文名', width: 26 },
    { key: 'orderZh', header: '目(中文)', width: 12 },
    { key: 'orderLatin', header: '目(拉丁)', width: 18, italic: true },
    { key: 'familyZh', header: '科(中文)', width: 14 },
    { key: 'familyLatin', header: '科(拉丁)', width: 18, italic: true },
    { key: 'genusZh', header: '属(中文)', width: 14 },
    { key: 'genusLatin', header: '属(拉丁)', width: 16, italic: true },
    { key: 'speciesEpithet', header: '种加词', width: 16, italic: true },
    { key: 'firstProvince', header: '首见省', width: 12 },
    { key: 'firstCity', header: '首见市', width: 12 },
    { key: 'firstDistrict', header: '首见区/县', width: 12 },
    { key: 'firstPointName', header: '首见观测点', width: 24 },
    { key: 'firstFullLocation', header: '首见完整地点', width: 32 },
    { key: 'firstCount', header: '首见数量', type: 'number', width: 10 },
    { key: 'firstRecordType', header: '首见记录类型', width: 13 },
    { key: 'firstSerialId', header: '首见报告编号', width: 18 },
    { key: 'recordNum', header: '总记录次数', type: 'number', width: 12 },
    { key: 'totalIndividualCount', header: '累计观测个体数', type: 'number', width: 14 },
    { key: 'allLocationsCount', header: '观测地点数', type: 'number', width: 12 },
    { key: 'allLocations', header: '历史观测地点汇总(去重)', width: 42 },
    { key: 'chinaLevel', header: '国家保护等级', width: 14 },
    { key: 'iucn', header: 'IUCN等级', width: 10 },
    { key: 'taxonId', header: '郑四鸟种编号', width: 13 },
    { key: 'checklistScope', header: '名录归属', width: 13 },
  ];

  const RECORD_COLUMNS = [
    { key: 'seq', header: '序号', type: 'number', width: 8 },
    { key: 'obsDate', header: '观测日期', width: 13 },
    { key: 'startTime', header: '观测开始时间', width: 20 },
    { key: 'endTime', header: '观测结束时间', width: 20 },
    { key: 'isFirstAddition', header: '是否首加', width: 10 },
    { key: 'taxonName', header: '中文名(种)', width: 16 },
    { key: 'latinName', header: '拉丁学名', width: 26, italic: true },
    { key: 'englishName', header: '英文名', width: 26 },
    { key: 'orderZh', header: '目(中文)', width: 12 },
    { key: 'orderLatin', header: '目(拉丁)', width: 18, italic: true },
    { key: 'familyZh', header: '科(中文)', width: 14 },
    { key: 'familyLatin', header: '科(拉丁)', width: 18, italic: true },
    { key: 'genusZh', header: '属(中文)', width: 14 },
    { key: 'genusLatin', header: '属(拉丁)', width: 16, italic: true },
    { key: 'taxonCount', header: '数量', type: 'number', width: 10 },
    { key: 'province', header: '省', width: 12 },
    { key: 'city', header: '市', width: 12 },
    { key: 'district', header: '区/县', width: 12 },
    { key: 'pointName', header: '观测点名称', width: 24 },
    { key: 'fullLocation', header: '完整地点', width: 32 },
    { key: 'recordType', header: '记录类型', width: 11 },
    { key: 'serialId', header: '报告编号', width: 18 },
    { key: 'status', header: '状态', width: 15 },
    { key: 'chinaLevel', header: '国家保护等级', width: 14 },
    { key: 'iucn', header: 'IUCN等级', width: 10 },
    { key: 'taxonId', header: '郑四鸟种编号', width: 13 },
    { key: 'ctime', header: '创建时间', width: 20 },
  ];

  const REPORT_COLUMNS = [
    { key: 'seq', header: '序号', type: 'number', width: 8 },
    { key: 'obsDate', header: '观测日期', width: 13 },
    { key: 'startTime', header: '观测开始时间', width: 20 },
    { key: 'endTime', header: '观测结束时间', width: 20 },
    { key: 'serialId', header: '报告编号', width: 18 },
    { key: 'recordType', header: '记录类型', width: 11 },
    { key: 'province', header: '省', width: 12 },
    { key: 'city', header: '市', width: 12 },
    { key: 'district', header: '区/县', width: 12 },
    { key: 'pointName', header: '观测点名称', width: 24 },
    { key: 'fullLocation', header: '完整地点', width: 32 },
    { key: 'speciesCount', header: '记录鸟种数', type: 'number', width: 12 },
    { key: 'newSpeciesCount', header: '首加新种数', type: 'number', width: 12 },
    { key: 'rowCount', header: '原始记录条数', type: 'number', width: 13 },
    { key: 'totalCount', header: '累计个体数', type: 'number', width: 12 },
    { key: 'speciesNames', header: '观测鸟种列表', width: 52 },
  ];

  // =========================================================================
  // 4. Zero-Dependency Pure-JS XLSX (OOXML + Store ZIP) & CSV Exporters
  // =========================================================================

  function xmlEscape(str) {
    return String(str)
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function colIndexToLetter(colIdx) {
    let n = colIdx + 1;
    let s = '';
    while (n > 0) {
      const rem = (n - 1) % 26;
      s = String.fromCharCode(65 + rem) + s;
      n = Math.floor((n - 1) / 26);
    }
    return s;
  }

  function buildWorksheetXml(columns, rows, opts = {}) {
    const colCount = columns.length;
    const rowCount = rows.length + 1;
    const lastCol = colIndexToLetter(Math.max(0, colCount - 1));

    const colsXml = columns
      .map((c, i) => `<col min="${i + 1}" max="${i + 1}" width="${c.width || 16}" customWidth="1"/>`)
      .join('');

    const parts = [];
    parts.push('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>');
    parts.push('<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">');
    parts.push('<sheetViews><sheetView workbookViewId="0"' + (opts.tabSelected ? ' tabSelected="1"' : '') + '>');
    if (opts.freezeHeader !== false) {
      parts.push('<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>');
    }
    parts.push('</sheetView></sheetViews>');
    parts.push('<sheetFormatPr defaultRowHeight="20"/>');
    parts.push(`<cols>${colsXml}</cols>`);
    parts.push('<sheetData>');

    let headerCells = '';
    for (let c = 0; c < colCount; c++) {
      const ref = `${colIndexToLetter(c)}1`;
      headerCells += `<c r="${ref}" t="inlineStr" s="1"><is><t>${xmlEscape(columns[c].header)}</t></is></c>`;
    }
    parts.push(`<row r="1" ht="24" customHeight="1">${headerCells}</row>`);

    for (let r = 0; r < rows.length; r++) {
      const rowNum = r + 2;
      const rowObj = rows[r];
      let rowCells = '';
      for (let c = 0; c < colCount; c++) {
        const col = columns[c];
        const rawVal = rowObj[col.key];
        const ref = `${colIndexToLetter(c)}${rowNum}`;
        const styleId = col.italic ? 2 : 0;

        if (rawVal === null || rawVal === undefined || rawVal === '') {
          rowCells += `<c r="${ref}" s="${styleId}"/>`;
        } else if (typeof rawVal === 'number' && Number.isFinite(rawVal)) {
          rowCells += `<c r="${ref}" s="${styleId}"><v>${rawVal}</v></c>`;
        } else if (col.type === 'number' && /^-?\d+(\.\d+)?$/.test(String(rawVal).trim())) {
          rowCells += `<c r="${ref}" s="${styleId}"><v>${String(rawVal).trim()}</v></c>`;
        } else {
          rowCells += `<c r="${ref}" t="inlineStr" s="${styleId}"><is><t>${xmlEscape(rawVal)}</t></is></c>`;
        }
      }
      parts.push(`<row r="${rowNum}">${rowCells}</row>`);
    }

    parts.push('</sheetData>');
    if (opts.autoFilter !== false && rowCount >= 1) {
      parts.push(`<autoFilter ref="A1:${lastCol}${rowCount}"/>`);
    }
    parts.push('</worksheet>');
    return parts.join('');
  }

  function buildSummarySheetRows(summary) {
    const rows = [
      { colA: '账号', colB: summary.account, colC: '', colD: '' },
      { colA: '导出时间', colB: summary.exportTime, colC: '', colD: '' },
      { colA: '分类名录标准', colB: summary.taxonomyVersion, colC: '', colD: '' },
      { colA: '总目数', colB: summary.totalOrders, colC: '总科数', colD: summary.totalFamilies },
      { colA: '总属数', colB: summary.totalGenera, colC: '郑四总鸟种数', colD: summary.totalSpecies },
      { colA: '观鸟报告数(行程)', colB: summary.totalReports, colC: '原始记录总条数', colD: summary.totalRecords },
      { colA: '匹配首见地点种数', colB: summary.matchedLocationSpecies, colC: '', colD: '' },
      { colA: '', colB: '', colC: '', colD: '' },
      { colA: '按年份统计', colB: '当年新增首加鸟种数', colC: '当年记录条数', colD: '' },
    ];
    for (const y of summary.years) {
      rows.push({ colA: y.year, colB: y.newSpecies, colC: y.records, colD: '' });
    }
    rows.push({ colA: '', colB: '', colC: '', colD: '' });
    rows.push({ colA: '按首见省份统计', colB: '首加鸟种数', colC: '', colD: '' });
    for (const p of summary.provinces) {
      rows.push({ colA: p.province, colB: p.firstSpeciesCount, colC: '', colD: '' });
    }
    return rows;
  }

  const CRC32_TABLE = (() => {
    const tbl = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let j = 0; j < 8; j++) {
        c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      }
      tbl[i] = c >>> 0;
    }
    return tbl;
  })();

  function crc32(bytes) {
    let crc = 0xFFFFFFFF;
    for (let i = 0; i < bytes.length; i++) {
      crc = CRC32_TABLE[(crc ^ bytes[i]) & 0xFF] ^ (crc >>> 8);
    }
    return (crc ^ 0xFFFFFFFF) >>> 0;
  }

  function createZipUint8Array(files) {
    const encoder = new TextEncoder();
    const localParts = [];
    const centralParts = [];
    let offset = 0;

    for (const f of files) {
      const nameBytes = encoder.encode(f.name);
      const dataBytes = typeof f.content === 'string' ? encoder.encode(f.content) : f.content;
      const crc = crc32(dataBytes);

      const localHeader = new Uint8Array(30 + nameBytes.length);
      const lv = new DataView(localHeader.buffer);
      lv.setUint32(0, 0x04034b50, true);
      lv.setUint16(4, 20, true);
      lv.setUint16(6, 0x0800, true);
      lv.setUint16(8, 0, true);
      lv.setUint16(10, 0, true);
      lv.setUint16(12, 0x5421, true);
      lv.setUint32(14, crc, true);
      lv.setUint32(18, dataBytes.length, true);
      lv.setUint32(22, dataBytes.length, true);
      lv.setUint16(26, nameBytes.length, true);
      lv.setUint16(28, 0, true);
      localHeader.set(nameBytes, 30);

      localParts.push(localHeader, dataBytes);

      const centralHeader = new Uint8Array(46 + nameBytes.length);
      const cv = new DataView(centralHeader.buffer);
      cv.setUint32(0, 0x02014b50, true);
      cv.setUint16(4, 20, true);
      cv.setUint16(6, 20, true);
      cv.setUint16(8, 0x0800, true);
      cv.setUint16(10, 0, true);
      cv.setUint16(12, 0, true);
      cv.setUint16(14, 0x5421, true);
      cv.setUint32(16, crc, true);
      cv.setUint32(20, dataBytes.length, true);
      cv.setUint32(24, dataBytes.length, true);
      cv.setUint16(28, nameBytes.length, true);
      cv.setUint16(30, 0, true);
      cv.setUint16(32, 0, true);
      cv.setUint16(34, 0, true);
      cv.setUint16(36, 0, true);
      cv.setUint32(38, 0, true);
      cv.setUint32(42, offset, true);
      centralHeader.set(nameBytes, 46);

      centralParts.push(centralHeader);
      offset += localHeader.length + dataBytes.length;
    }

    const centralSize = centralParts.reduce((s, p) => s + p.length, 0);
    const eocd = new Uint8Array(22);
    const ev = new DataView(eocd.buffer);
    ev.setUint32(0, 0x06054b50, true);
    ev.setUint16(4, 0, true);
    ev.setUint16(6, 0, true);
    ev.setUint16(8, files.length, true);
    ev.setUint16(10, files.length, true);
    ev.setUint32(12, centralSize, true);
    ev.setUint32(16, offset, true);
    ev.setUint16(20, 0, true);

    const totalLen = offset + centralSize + eocd.length;
    const result = new Uint8Array(totalLen);
    let pos = 0;
    for (const p of localParts) {
      result.set(p, pos);
      pos += p.length;
    }
    for (const p of centralParts) {
      result.set(p, pos);
      pos += p.length;
    }
    result.set(eocd, pos);
    return result;
  }

  function buildXlsxBytes(dataset) {
    const summaryCols = [
      { key: 'colA', header: '指标 / 维度', width: 22 },
      { key: 'colB', header: '数值 / 说明', width: 32 },
      { key: 'colC', header: '辅助指标', width: 24 },
      { key: 'colD', header: '辅助数值', width: 16 },
    ];
    const summaryRows = buildSummarySheetRows(dataset.summary);

    const sheet1Xml = buildWorksheetXml(SPECIES_COLUMNS, dataset.speciesTimeline, { tabSelected: true });
    const sheet2Xml = buildWorksheetXml(RECORD_COLUMNS, dataset.records, { tabSelected: false });
    const sheet3Xml = buildWorksheetXml(REPORT_COLUMNS, dataset.reports, { tabSelected: false });
    const sheet4Xml = buildWorksheetXml(summaryCols, summaryRows, { tabSelected: false, autoFilter: false });

    const contentTypesXml =
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
      '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
      '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
      '<Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
      '<Override PartName="/xl/worksheets/sheet3.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
      '<Override PartName="/xl/worksheets/sheet4.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
      '</Types>';

    const relsXml =
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
      '</Relationships>';

    const workbookXml =
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
      '<sheets>' +
      '<sheet name="郑四总鸟种首加时间线" sheetId="1" r:id="rId1"/>' +
      '<sheet name="全部观鸟记录明细" sheetId="2" r:id="rId2"/>' +
      '<sheet name="观鸟报告汇总" sheetId="3" r:id="rId3"/>' +
      '<sheet name="统计概览" sheetId="4" r:id="rId4"/>' +
      '</sheets>' +
      '</workbook>';

    const workbookRelsXml =
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>' +
      '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/>' +
      '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet3.xml"/>' +
      '<Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet4.xml"/>' +
      '<Relationship Id="rId5" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
      '</Relationships>';

    const stylesXml =
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      '<fonts count="3">' +
      '<font><sz val="11"/><name val="Microsoft YaHei"/></font>' +
      '<font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Microsoft YaHei"/></font>' +
      '<font><i/><sz val="11"/><name val="Microsoft YaHei"/></font>' +
      '</fonts>' +
      '<fills count="3">' +
      '<fill><patternFill patternType="none"/></fill>' +
      '<fill><patternFill patternType="gray125"/></fill>' +
      '<fill><patternFill patternType="solid"><fgColor rgb="FF1F5E3B"/><bgColor indexed="64"/></patternFill></fill>' +
      '</fills>' +
      '<borders count="2">' +
      '<border><left/><right/><top/><bottom/><diagonal/></border>' +
      '<border>' +
      '<left style="thin"><color rgb="FFE2E4E1"/></left>' +
      '<right style="thin"><color rgb="FFE2E4E1"/></right>' +
      '<top style="thin"><color rgb="FFE2E4E1"/></top>' +
      '<bottom style="thin"><color rgb="FFE2E4E1"/></bottom>' +
      '<diagonal/>' +
      '</border>' +
      '</borders>' +
      '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
      '<cellXfs count="3">' +
      '<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1"><alignment vertical="center"/></xf>' +
      '<xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>' +
      '<xf numFmtId="0" fontId="2" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1"><alignment vertical="center"/></xf>' +
      '</cellXfs>' +
      '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
      '</styleSheet>';

    return createZipUint8Array([
      { name: '[Content_Types].xml', content: contentTypesXml },
      { name: '_rels/.rels', content: relsXml },
      { name: 'xl/workbook.xml', content: workbookXml },
      { name: 'xl/_rels/workbook.xml.rels', content: workbookRelsXml },
      { name: 'xl/styles.xml', content: stylesXml },
      { name: 'xl/worksheets/sheet1.xml', content: sheet1Xml },
      { name: 'xl/worksheets/sheet2.xml', content: sheet2Xml },
      { name: 'xl/worksheets/sheet3.xml', content: sheet3Xml },
      { name: 'xl/worksheets/sheet4.xml', content: sheet4Xml },
    ]);
  }

  function buildCsvString(columns, rows) {
    const escapeCell = (val) => {
      const s = val === null || val === undefined ? '' : String(val);
      if (/[",\r\n]/.test(s)) {
        return '"' + s.replace(/"/g, '""') + '"';
      }
      return s;
    };
    const lines = [];
    lines.push(columns.map((c) => escapeCell(c.header)).join(','));
    for (const row of rows) {
      lines.push(columns.map((c) => escapeCell(row[c.key])).join(','));
    }
    return '\uFEFF' + lines.join('\r\n');
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      TAXONOMY_DICT,
      SPECIES_COLUMNS,
      RECORD_COLUMNS,
      REPORT_COLUMNS,
      enrichTaxonomy,
      formatLocation,
      parseTimelineRanks,
      dedupeRecords,
      buildExportDataset,
      buildXlsxBytes,
      buildCsvString,
    };
    return;
  }

  // =========================================================================
  // 5. Browser Network & AES Decryption Layer
  // =========================================================================

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function getLoggedInUser() {
    try {
      const raw = localStorage.getItem('$user');
      if (!raw || raw === '{}' || raw === 'null') return null;
      const obj = JSON.parse(raw);
      return obj && obj.token ? obj : null;
    } catch (_) {
      return null;
    }
  }

  function loadScriptOnce(src) {
    return new Promise((resolve, reject) => {
      if (document.querySelector(`script[src="${src}"]`)) {
        resolve();
        return;
      }
      const s = document.createElement('script');
      s.src = src;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error(`加载脚本失败: ${src}`));
      document.head.appendChild(s);
    });
  }

  async function ensureSiteAesLoaded() {
    if (window.BIRDREPORT_APIJS && typeof window.BIRDREPORT_APIJS.decode === 'function') {
      return true;
    }
    try {
      if (location.hostname.endsWith('birdreport.cn')) {
        if (!window.CryptoJS) {
          await loadScriptOnce('/plugins/crypto-js/crypto-js.min.js');
        }
        await loadScriptOnce('/assets/js/aes.util.js');
        if (window.BIRDREPORT_APIJS && typeof window.BIRDREPORT_APIJS.decode === 'function') {
          return true;
        }
      }
    } catch (_) {}
    return false;
  }

  async function decryptBirdreportData(cipherOrData) {
    if (Array.isArray(cipherOrData) || (cipherOrData && typeof cipherOrData === 'object')) {
      return cipherOrData;
    }
    if (typeof cipherOrData !== 'string' || !cipherOrData.trim()) {
      return [];
    }

    if (cipherOrData.trim().startsWith('[') || cipherOrData.trim().startsWith('{')) {
      try {
        return JSON.parse(cipherOrData);
      } catch (_) {}
    }

    if (window.BIRDREPORT_APIJS && typeof window.BIRDREPORT_APIJS.decode === 'function') {
      const plain = window.BIRDREPORT_APIJS.decode(cipherOrData);
      return JSON.parse(plain);
    }

    const enc = new TextEncoder();
    const keyBytes = enc.encode(AES_KEY_STR);
    const ivBytes = enc.encode(AES_IV_STR);
    const binStr = atob(cipherOrData);
    const cipherBytes = new Uint8Array(binStr.length);
    for (let i = 0; i < binStr.length; i++) cipherBytes[i] = binStr.charCodeAt(i);

    const cryptoKey = await window.crypto.subtle.importKey(
      'raw',
      keyBytes,
      { name: 'AES-CBC' },
      false,
      ['decrypt']
    );
    const plainBuf = await window.crypto.subtle.decrypt(
      { name: 'AES-CBC', iv: ivBytes },
      cryptoKey,
      cipherBytes
    );
    const plainText = new TextDecoder('utf-8').decode(plainBuf);
    return JSON.parse(plainText);
  }

  async function postApi(path, bodyObj, { token, asJson = false, retries = 3 } = {}) {
    const url = API_BASE + path;
    const headers = {
      Accept: 'application/json, text/javascript, */*; q=0.01',
      'X-Auth-Token': token,
      'Content-Type': asJson
        ? 'application/json; charset=UTF-8'
        : 'application/x-www-form-urlencoded; charset=UTF-8',
    };

    const body = asJson
      ? JSON.stringify(bodyObj || {})
      : new URLSearchParams(
          Object.entries(bodyObj || {}).map(([k, v]) => [k, v === undefined || v === null ? '' : String(v)])
        ).toString();

    let lastErr = null;
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const resp = await fetch(url, { method: 'POST', headers, body });
        if (resp.status === 401) {
          throw new Error('登录凭证已失效（HTTP 401），请重新登录中国观鸟记录中心');
        }
        if (!resp.ok) {
          throw new Error(`接口 ${path} 返回 HTTP ${resp.status}`);
        }
        const json = await resp.json();
        if (json && Number(json.code) === -902) {
          throw new Error('登录已超时，请重新登录后再试');
        }
        return json;
      } catch (err) {
        lastErr = err;
        if (String(err.message).includes('登录')) throw err;
        if (attempt < retries) await sleep(400 * attempt);
      }
    }
    throw lastErr;
  }

  async function fetchAllUserData(options, onProgress) {
    const user = getLoggedInUser();
    if (!user) {
      throw new Error('未检测到登录状态，请先登录中国观鸟记录中心');
    }

    const token = user.token;
    const memberId = user.id;
    const account = user.account || '';
    const startDate = safeStr(options.startDate) || '2000-01-01';
    const endDate = safeStr(options.endDate) || `${new Date().getFullYear()}-12-31`;
    const useCustomDate = Boolean(safeStr(options.startDate) || safeStr(options.endDate));

    onProgress(5, '正在初始化解密组件');
    await ensureSiteAesLoaded();

    onProgress(12, '1/4 获取郑四版分类库');
    let z4TaxonList = [];
    try {
      const z4Res = await postApi(
        'member/system/taxon/version',
        { version: Z4_TAXON_VERSION },
        { token, asJson: false }
      );
      if (z4Res && Array.isArray(z4Res.data)) z4TaxonList = z4Res.data;
    } catch (e) {
      console.warn('[BirdReportExport] 获取郑四分类库失败:', e);
    }

    onProgress(22, '2/4 获取个人郑四总鸟种清单');
    const baseStatParams = {
      version: 'CH4',
      start_min_time: startDate,
      start_max_time: endDate,
      start: startDate,
      end: endDate,
      member_id: memberId,
      outside_type: 0,
    };
    let groupBirds = [];
    const grpRes = await postApi(
      'member/system/user/statistics/record_group_birds',
      baseStatParams,
      { token, asJson: false }
    );
    if (grpRes && Array.isArray(grpRes.data)) groupBirds = grpRes.data;

    let outsideGroupBirds = [];
    if (options.includeOutside) {
      onProgress(28, '2/4 补充拉取名录外鸟种');
      try {
        const outRes = await postApi(
          'member/system/user/statistics/record_group_birds',
          { ...baseStatParams, outside_type: 1 },
          { token, asJson: false }
        );
        if (outRes && Array.isArray(outRes.data)) outsideGroupBirds = outRes.data;
      } catch (e) {
        console.warn('[BirdReportExport] 获取名录外鸟种失败:', e);
      }
    }

    onProgress(34, '3/4 获取官方鸟种首加时间线');
    let timelineData = [];
    try {
      const tlRes = await postApi(
        'member/system/user/statistics/bird_timeline',
        {
          version: 'CH4',
          start_min_time: startDate,
          start_max_time: endDate,
          start: startDate,
          end: endDate,
          member_id: memberId,
        },
        { token, asJson: false }
      );
      if (tlRes && Array.isArray(tlRes.data)) timelineData = tlRes.data;
    } catch (e) {
      console.warn('[BirdReportExport] 获取首加时间线失败:', e);
    }

    onProgress(40, '4/4 正在分页拉取全部原始观鸟记录');
    const allRecords = [];
    let page = 1;
    let totalCount = null;
    let effectiveLimit = PAGE_SIZE;
    let totalPages = 1;
    let fallbackNoVersion = false;

    while (page <= MAX_PAGES) {
      const reqPayload = fallbackNoVersion
        ? {
            start_date: useCustomDate ? startDate : '',
            end_date: useCustomDate ? endDate : '',
            page,
            limit: PAGE_SIZE,
          }
        : {
            version: 'CH4',
            member_id: memberId,
            start_min_time: startDate,
            start_max_time: endDate,
            start_date: startDate,
            end_date: endDate,
            page,
            limit: PAGE_SIZE,
            sortBy: '',
            orderBy: '',
          };

      const recRes = await postApi('member/system/record/taxon', reqPayload, {
        token,
        asJson: true,
      });

      if (page === 1 && (!recRes || !Number(recRes.count)) && !fallbackNoVersion && groupBirds.length > 0) {
        fallbackNoVersion = true;
        continue;
      }

      if (totalCount === null) {
        totalCount = Number(recRes && recRes.count) || 0;
      }

      if (!recRes || !recRes.data || totalCount === 0) break;

      const pageRows = await decryptBirdreportData(recRes.data);
      if (!Array.isArray(pageRows) || pageRows.length === 0) break;

      if (page === 1 && pageRows.length < PAGE_SIZE && totalCount > pageRows.length) {
        effectiveLimit = pageRows.length;
      }
      totalPages = Math.max(1, Math.ceil(totalCount / effectiveLimit));

      // Tag duplicate keys within the same page so legitimate repeated sightings are never dropped
      const inPageCounts = new Map();
      for (const row of pageRows) {
        const k = recordCompositeKey(row);
        const occ = (inPageCounts.get(k) || 0) + 1;
        inPageCounts.set(k, occ);
        if (occ > 1) row._pageOccurrence = occ;
        allRecords.push(row);
      }

      const pct = Math.min(95, 40 + Math.round((Math.min(allRecords.length, totalCount) / totalCount) * 55));
      onProgress(
        pct,
        `4/4 拉取第 ${page} / ${totalPages} 页 · 已获取 ${allRecords.length} / ${totalCount} 条原始记录`
      );

      if (allRecords.length >= totalCount) break;
      page += 1;
      await sleep(PAGE_DELAY_MS);
    }

    onProgress(98, '正在关联首见地点并补全目/科/属/种与拉丁学名');
    return {
      account,
      z4TaxonList,
      groupBirds,
      outsideGroupBirds,
      timelineData,
      allRecords,
    };
  }

  function triggerDownload(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 1000);
  }

  function buildFilename(account, suffix, ext) {
    const now = new Date();
    const ymd = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(
      now.getDate()
    ).padStart(2, '0')}`;
    const safeAcc = (account || 'birdreport').replace(/[\\/:*?"<>|\s]+/g, '_');
    return `中国观鸟记录中心_${safeAcc}_${suffix}_${ymd}.${ext}`;
  }

  // =========================================================================
  // 6. HeroUI v3 (oklch tokens) + Unslop UI (Zero Emoji, Unified 16px SVG)
  // =========================================================================

  const ICONS = {
    bird: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M16 7h.01"/><path d="M3.4 18H12a8 8 0 0 0 8-8V7a4 4 0 0 0-7.28-2.3L2 20"/><path d="m20 7 2 .5-2 .5"/><path d="M10 18v3"/><path d="M14 17.75V21"/><path d="M7 18a6 6 0 0 0 3.84-10.61"/></svg>',
    close: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>',
    refresh: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></svg>',
    download: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>',
    calendar: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/></svg>',
    switchUser: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m16 3 4 4-4 4"/><path d="M20 7H4"/><path d="m8 21-4-4 4-4"/><path d="M4 17h16"/></svg>',
    logOut: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/></svg>',
  };

  const SAVED_ACCOUNTS_KEY = '$brex_saved_accounts';

  function loadSavedAccounts() {
    try {
      const raw = localStorage.getItem(SAVED_ACCOUNTS_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr.filter((a) => a && a.token && (a.id || a.account)) : [];
    } catch (_) {
      return [];
    }
  }

  function persistSavedAccounts(list) {
    try {
      localStorage.setItem(SAVED_ACCOUNTS_KEY, JSON.stringify(list));
    } catch (_) {}
  }

  function rememberCurrentAccount(user) {
    if (!user || !user.token) return;
    const list = loadSavedAccounts();
    const uid = safeStr(user.id || user.account);
    const idx = list.findIndex((a) => safeStr(a.id || a.account) === uid);
    const entry = { ...user, _savedAt: Date.now() };
    if (idx >= 0) {
      list[idx] = entry;
    } else {
      list.unshift(entry);
    }
    persistSavedAccounts(list.slice(0, 10));
  }

  function switchToSavedAccount(targetId) {
    const list = loadSavedAccounts();
    const target = list.find((a) => safeStr(a.id || a.account) === safeStr(targetId));
    if (!target) return false;
    const cleanUser = { ...target };
    delete cleanUser._savedAt;
    localStorage.setItem('$user', JSON.stringify(cleanUser));
    cachedRawData = null;
    cachedOptionsKey = '';
    const nameEl = document.getElementById('username') || document.getElementById('userinfo');
    if (nameEl && cleanUser.account) nameEl.textContent = cleanUser.account;
    return true;
  }

  function removeSavedAccount(targetId) {
    const list = loadSavedAccounts().filter((a) => safeStr(a.id || a.account) !== safeStr(targetId));
    persistSavedAccounts(list);
  }

  function normalizeUserDateInput(val) {
    const s = safeStr(val);
    if (!s) return '';
    const m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
    if (!m) {
      throw new Error(`日期格式不正确（${s}），请输入如 2024-01-01 或留空`);
    }
    return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  }

  let cachedRawData = null;
  let cachedOptionsKey = '';

  function injectStyles() {
    if (document.getElementById('brex-style')) return;
    const style = document.createElement('style');
    style.id = 'brex-style';
    style.textContent = `
      :root {
        --brex-bg: oklch(0.985 0.003 105);
        --brex-surface: oklch(1 0 0);
        --brex-surface-2: oklch(0.965 0.004 105);
        --brex-border: oklch(0.2 0.006 105 / 0.1);
        --brex-border-strong: oklch(0.2 0.006 105 / 0.18);
        --brex-fg: oklch(0.2 0.008 110);
        --brex-fg-secondary: oklch(0.45 0.008 110);
        --brex-fg-muted: oklch(0.58 0.006 110);
        --brex-accent: oklch(0.42 0.085 155);
        --brex-accent-hover: oklch(0.36 0.085 155);
        --brex-accent-fg: oklch(0.99 0 0);
        --brex-danger: oklch(0.52 0.16 25);
        --brex-warn: oklch(0.65 0.14 75);
        --brex-ring: oklch(0.42 0.085 155 / 0.32);
        --brex-font: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
        --brex-ease: cubic-bezier(0.2, 0.8, 0.2, 1);
      }

      #brex-fab {
        position: fixed;
        right: 24px;
        bottom: 24px;
        z-index: 2147483640;
        height: 40px;
        padding: 0 16px;
        border-radius: 10px;
        border: 1px solid var(--brex-border-strong);
        background: var(--brex-surface);
        color: var(--brex-fg);
        font-family: var(--brex-font);
        font-size: 13px;
        font-weight: 500;
        display: inline-flex;
        align-items: center;
        gap: 8px;
        cursor: pointer;
        box-shadow: 0 2px 8px oklch(0.15 0 0 / 0.08), 0 1px 2px oklch(0.15 0 0 / 0.06);
        transition: background-color 140ms var(--brex-ease), border-color 140ms var(--brex-ease), transform 120ms var(--brex-ease);
      }
      #brex-fab:hover {
        background: var(--brex-surface-2);
        border-color: var(--brex-accent);
      }
      #brex-fab:active { transform: scale(0.98); }
      #brex-fab:focus-visible {
        outline: 2px solid var(--brex-ring);
        outline-offset: 2px;
      }
      #brex-fab .brex-fab-icon {
        color: var(--brex-accent);
        display: inline-flex;
      }

      #brex-overlay {
        position: fixed;
        inset: 0;
        z-index: 2147483645;
        background: oklch(0.15 0.005 110 / 0.42);
        display: none;
        align-items: center;
        justify-content: center;
        padding: 16px;
        font-family: var(--brex-font);
        box-sizing: border-box;
      }
      #brex-overlay.open { display: flex; }

      #brex-modal, #brex-modal * { box-sizing: border-box; }

      #brex-modal {
        width: 440px;
        max-width: 100%;
        max-height: calc(100vh - 32px);
        overflow-y: auto;
        background: var(--brex-surface);
        color: var(--brex-fg);
        border-radius: 14px;
        box-shadow: 0 16px 40px oklch(0.15 0.005 110 / 0.16), 0 1px 4px oklch(0.15 0.005 110 / 0.08);
      }

      .brex-header {
        padding: 20px 20px 14px;
        border-bottom: 1px solid var(--brex-border);
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 12px;
      }
      .brex-brand {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .brex-brand-icon {
        color: var(--brex-accent);
        display: inline-flex;
        flex-shrink: 0;
      }
      .brex-title {
        margin: 0;
        font-size: 15px;
        font-weight: 600;
        line-height: 1.3;
        color: var(--brex-fg);
      }
      .brex-sub {
        margin: 6px 0 0;
        font-size: 12px;
        font-weight: 400;
        color: var(--brex-fg-secondary);
        line-height: 1.45;
      }
      .brex-icon-btn {
        width: 28px;
        height: 28px;
        border-radius: 6px;
        border: none;
        background: transparent;
        color: var(--brex-fg-secondary);
        display: inline-flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        flex-shrink: 0;
        transition: background-color 140ms var(--brex-ease), color 140ms var(--brex-ease);
      }
      .brex-icon-btn:hover {
        background: var(--brex-surface-2);
        color: var(--brex-fg);
      }
      .brex-icon-btn:focus-visible {
        outline: 2px solid var(--brex-ring);
        outline-offset: 1px;
      }

      .brex-body {
        padding: 16px 20px 20px;
        display: flex;
        flex-direction: column;
        gap: 14px;
      }

      .brex-account-bar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        font-size: 13px;
      }
      .brex-account-left {
        display: flex;
        align-items: center;
        gap: 8px;
        min-width: 0;
      }
      .brex-account-actions {
        display: flex;
        align-items: center;
        gap: 4px;
        flex-shrink: 0;
      }
      .brex-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: var(--brex-accent);
        flex-shrink: 0;
      }
      .brex-dot.warn { background: var(--brex-warn); }
      .brex-dot.muted { background: var(--brex-fg-muted); }
      .brex-account-text {
        color: var(--brex-fg);
        font-weight: 500;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .brex-account-muted {
        color: var(--brex-fg-muted);
        font-weight: 400;
      }
      .brex-ghost-btn {
        border: none;
        background: transparent;
        color: var(--brex-fg-secondary);
        font-family: var(--brex-font);
        font-size: 12px;
        font-weight: 400;
        padding: 4px 6px;
        border-radius: 6px;
        display: inline-flex;
        align-items: center;
        gap: 4px;
        cursor: pointer;
        text-decoration: none;
        transition: background-color 140ms var(--brex-ease), color 140ms var(--brex-ease);
      }
      .brex-ghost-btn:hover {
        background: var(--brex-surface-2);
        color: var(--brex-fg);
      }

      .brex-account-menu {
        display: none;
        flex-direction: column;
        gap: 2px;
        padding: 6px;
        border-radius: 8px;
        background: var(--brex-surface-2);
      }
      .brex-account-menu.open { display: flex; }
      .brex-account-item {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        padding: 6px 8px;
        border-radius: 6px;
        font-size: 12px;
        color: var(--brex-fg);
        cursor: pointer;
        transition: background-color 120ms var(--brex-ease);
      }
      .brex-account-item:hover {
        background: oklch(0.2 0.006 105 / 0.06);
      }
      .brex-account-item-main {
        display: flex;
        align-items: center;
        gap: 8px;
        min-width: 0;
        flex: 1;
      }
      .brex-account-item-name {
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .brex-account-tag {
        font-size: 11px;
        color: var(--brex-accent);
        flex-shrink: 0;
      }
      .brex-account-remove {
        border: none;
        background: transparent;
        color: var(--brex-fg-muted);
        width: 20px;
        height: 20px;
        border-radius: 4px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        flex-shrink: 0;
        font-size: 14px;
        line-height: 1;
      }
      .brex-account-remove:hover {
        background: oklch(0.2 0.006 105 / 0.08);
        color: var(--brex-fg);
      }
      .brex-account-add {
        margin-top: 2px;
        padding: 6px 8px;
        border-radius: 6px;
        border: none;
        background: transparent;
        color: var(--brex-fg-secondary);
        font-family: var(--brex-font);
        font-size: 12px;
        font-weight: 400;
        display: flex;
        align-items: center;
        gap: 6px;
        cursor: pointer;
        width: 100%;
        text-align: left;
        transition: background-color 120ms var(--brex-ease), color 120ms var(--brex-ease);
      }
      .brex-account-add:hover {
        background: oklch(0.2 0.006 105 / 0.06);
        color: var(--brex-fg);
      }

      #brex-modal label {
        margin: 0;
        font-weight: 400;
        font-size: 12px;
      }

      .brex-row {
        display: flex;
        align-items: center;
        gap: 8px;
        min-width: 0;
      }
      .brex-label {
        font-size: 12px;
        font-weight: 400;
        color: var(--brex-fg-secondary);
        width: 56px;
        flex-shrink: 0;
        margin: 0;
      }
      .brex-date-inputs {
        flex: 1;
        min-width: 0;
        width: 100%;
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
        align-items: center;
        gap: 8px;
      }
      .brex-date-field {
        position: relative;
        min-width: 0;
        width: 100%;
      }
      .brex-input, .brex-select {
        height: 36px;
        border: none;
        border-radius: 8px;
        background: var(--brex-surface-2);
        color: var(--brex-fg);
        font-family: var(--brex-font);
        font-size: 12.5px;
        font-weight: 400;
        font-variant-numeric: tabular-nums;
      }
      .brex-input {
        width: 100%;
        min-width: 0;
        padding: 0 28px 0 10px;
      }
      .brex-cal-btn {
        position: absolute;
        right: 4px;
        top: 50%;
        transform: translateY(-50%);
        width: 24px;
        height: 24px;
        border: none;
        border-radius: 6px;
        background: transparent;
        color: var(--brex-fg-muted);
        display: inline-flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        padding: 0;
      }
      .brex-cal-btn:hover {
        color: var(--brex-fg);
        background: oklch(0.2 0.006 105 / 0.06);
      }
      .brex-native-date {
        position: absolute;
        right: 0;
        bottom: 0;
        width: 1px;
        height: 1px;
        opacity: 0;
        pointer-events: none;
        border: none;
        padding: 0;
      }
      .brex-input:focus, .brex-select:focus {
        outline: 2px solid var(--brex-ring);
        background: var(--brex-surface);
      }
      .brex-date-sep {
        font-size: 12px;
        color: var(--brex-fg-muted);
      }
      .brex-select {
        flex: 1;
        min-width: 0;
        padding: 0 10px;
        cursor: pointer;
      }

      .brex-check {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        font-size: 12px;
        font-weight: 400;
        color: var(--brex-fg-secondary);
        cursor: pointer;
        user-select: none;
        padding-left: 64px;
        margin: 0;
      }
      .brex-check input[type="checkbox"] {
        width: 15px;
        height: 15px;
        margin: 0;
        accent-color: var(--brex-accent);
        cursor: pointer;
      }

      .brex-btn {
        height: 36px;
        padding: 0 18px;
        border-radius: 8px;
        font-family: var(--brex-font);
        font-size: 13px;
        font-weight: 500;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        cursor: pointer;
        border: none;
        flex-shrink: 0;
        transition: background-color 140ms var(--brex-ease), transform 100ms var(--brex-ease), opacity 140ms var(--brex-ease);
      }
      .brex-btn:active:not(:disabled) { transform: scale(0.98); }
      .brex-btn:disabled { opacity: 0.5; cursor: not-allowed; }
      .brex-btn:focus-visible {
        outline: 2px solid var(--brex-ring);
        outline-offset: 2px;
      }
      .brex-btn-primary {
        background: var(--brex-accent);
        color: var(--brex-accent-fg);
      }
      .brex-btn-primary:hover:not(:disabled) {
        background: var(--brex-accent-hover);
      }

      .brex-progress-wrap {
        display: none;
        flex-direction: column;
        gap: 8px;
        padding-top: 4px;
      }
      .brex-progress-wrap.show { display: flex; }
      .brex-bar-track {
        height: 4px;
        border-radius: 4px;
        background: var(--brex-surface-2);
        overflow: hidden;
      }
      .brex-bar-fill {
        height: 100%;
        width: 0%;
        background: var(--brex-accent);
        transition: width 180ms var(--brex-ease);
      }
      .brex-status {
        font-size: 12px;
        color: var(--brex-fg-secondary);
        font-variant-numeric: tabular-nums;
        line-height: 1.45;
      }
      .brex-status.error { color: var(--brex-danger); }

      .brex-summary-line {
        display: none;
        font-size: 12.5px;
        color: var(--brex-fg-secondary);
        font-variant-numeric: tabular-nums;
        white-space: nowrap;
        overflow-x: auto;
        padding-top: 2px;
      }
      .brex-summary-line.show { display: block; }
      .brex-summary-line strong {
        color: var(--brex-fg);
        font-weight: 600;
      }
      .brex-summary-line .brex-accent-num {
        color: var(--brex-accent);
        font-weight: 600;
      }
    `;
    document.head.appendChild(style);
  }

  function createModalIfNeeded() {
    if (document.getElementById('brex-overlay')) return;
    const overlay = document.createElement('div');
    overlay.id = 'brex-overlay';
    overlay.innerHTML = `
      <div id="brex-modal" role="dialog" aria-modal="true" aria-labelledby="brex-title">
        <div class="brex-header">
          <div>
            <div class="brex-brand">
              <span class="brex-brand-icon">${ICONS.bird}</span>
              <h3 class="brex-title" id="brex-title">观鸟记录导出</h3>
            </div>
            <p class="brex-sub">导出郑四首加时间线、全量原始记录、报告汇总与统计概览（含目科属种与拉丁学名）</p>
          </div>
          <button type="button" class="brex-icon-btn" id="brex-close" aria-label="关闭">${ICONS.close}</button>
        </div>

        <div class="brex-body">
          <div id="brex-account-bar" class="brex-account-bar"></div>
          <div id="brex-account-menu" class="brex-account-menu"></div>

          <div class="brex-row">
            <span class="brex-label">观测日期</span>
            <div class="brex-date-inputs">
              <div class="brex-date-field">
                <input type="text" id="brex-start" class="brex-input" placeholder="" maxlength="10" autocomplete="off" aria-label="开始日期" />
                <button type="button" class="brex-cal-btn" data-target="brex-start" title="选择开始日期" aria-label="选择开始日期">${ICONS.calendar}</button>
                <input type="date" class="brex-native-date" data-target="brex-start" tabindex="-1" aria-hidden="true" />
              </div>
              <span class="brex-date-sep">至</span>
              <div class="brex-date-field">
                <input type="text" id="brex-end" class="brex-input" placeholder="" maxlength="10" autocomplete="off" aria-label="结束日期" />
                <button type="button" class="brex-cal-btn" data-target="brex-end" title="选择结束日期" aria-label="选择结束日期">${ICONS.calendar}</button>
                <input type="date" class="brex-native-date" data-target="brex-end" tabindex="-1" aria-hidden="true" />
              </div>
            </div>
          </div>

          <div class="brex-row">
            <label class="brex-label" for="brex-format">导出格式</label>
            <select id="brex-format" class="brex-select">
              <option value="xlsx">Excel (.xlsx · 含 4 张工作表)</option>
              <option value="csv">CSV (UTF-8 · 分表导出)</option>
              <option value="json">JSON (结构化备份)</option>
            </select>
            <button type="button" id="brex-export-btn" class="brex-btn brex-btn-primary">
              ${ICONS.download}
              <span>导出</span>
            </button>
          </div>

          <label class="brex-check">
            <input type="checkbox" id="brex-outside" />
            <span>包含名录外、分布外标红及逸出记录</span>
          </label>

          <div id="brex-progress-wrap" class="brex-progress-wrap">
            <div class="brex-bar-track"><div id="brex-bar-fill" class="brex-bar-fill"></div></div>
            <div id="brex-status" class="brex-status"></div>
          </div>

          <div id="brex-summary-line" class="brex-summary-line"></div>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    // Date fields: keep visible inputs plain text (always blank unless chosen) & bind calendar button
    overlay.querySelectorAll('.brex-cal-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const targetId = btn.getAttribute('data-target');
        const textInput = document.getElementById(targetId);
        const nativeInput = btn.parentElement.querySelector('.brex-native-date');
        if (!textInput || !nativeInput) return;
        const val = safeStr(textInput.value);
        if (/^\d{4}-\d{2}-\d{2}$/.test(val)) {
          nativeInput.value = val;
        }
        if (typeof nativeInput.showPicker === 'function') {
          try {
            nativeInput.showPicker();
            return;
          } catch (_) {}
        }
        nativeInput.focus();
        nativeInput.click();
      });
    });

    overlay.querySelectorAll('.brex-native-date').forEach((nativeInput) => {
      nativeInput.addEventListener('change', () => {
        const targetId = nativeInput.getAttribute('data-target');
        const textInput = document.getElementById(targetId);
        if (textInput && nativeInput.value) {
          textInput.value = nativeInput.value;
        }
      });
    });

    const close = () => overlay.classList.remove('open');
    overlay.querySelector('#brex-close').addEventListener('click', close);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) close();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && overlay.classList.contains('open')) close();
    });

    const setStatus = (pct, msg, isError = false) => {
      const wrap = document.getElementById('brex-progress-wrap');
      const fill = document.getElementById('brex-bar-fill');
      const status = document.getElementById('brex-status');
      wrap.classList.add('show');
      if (pct >= 0) fill.style.width = `${Math.max(0, Math.min(100, pct))}%`;
      status.className = isError ? 'brex-status error' : 'brex-status';
      status.textContent = msg;
    };

    const renderAccountMenu = (currentUser) => {
      const menu = document.getElementById('brex-account-menu');
      const accounts = loadSavedAccounts();
      const currentUid = currentUser ? safeStr(currentUser.id || currentUser.account) : '';

      const itemsHtml = accounts
        .map((acc) => {
          const uid = safeStr(acc.id || acc.account);
          const isActive = currentUser && uid === currentUid;
          const label = xmlEscape(acc.account || uid);
          return `
            <div class="brex-account-item" data-switch-id="${xmlEscape(uid)}">
              <div class="brex-account-item-main">
                <span class="brex-dot ${isActive ? '' : 'muted'}"></span>
                <span class="brex-account-item-name">${label}</span>
              </div>
              ${isActive ? '<span class="brex-account-tag">当前</span>' : `<button type="button" class="brex-account-remove" data-remove-id="${xmlEscape(uid)}" title="移除记录">×</button>`}
            </div>
          `;
        })
        .join('');

      menu.innerHTML = `
        ${itemsHtml}
        <button type="button" id="brex-login-other" class="brex-account-add">
          ${ICONS.logOut}
          <span>登录其他账号</span>
        </button>
      `;

      menu.querySelectorAll('.brex-account-item').forEach((item) => {
        item.addEventListener('click', (e) => {
          if (e.target && e.target.closest('.brex-account-remove')) return;
          const uid = item.getAttribute('data-switch-id');
          if (currentUser && uid === currentUid) {
            menu.classList.remove('open');
            return;
          }
          if (switchToSavedAccount(uid)) {
            menu.classList.remove('open');
            document.getElementById('brex-summary-line').classList.remove('show');
            document.getElementById('brex-progress-wrap').classList.remove('show');
            refreshUserBar();
            const nextUser = getLoggedInUser();
            setStatus(0, `已切换至账号：${(nextUser && (nextUser.account || nextUser.id)) || uid}`);
          }
        });
      });

      menu.querySelectorAll('.brex-account-remove').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          removeSavedAccount(btn.getAttribute('data-remove-id'));
          renderAccountMenu(getLoggedInUser());
        });
      });

      const loginOther = document.getElementById('brex-login-other');
      if (loginOther) {
        loginOther.addEventListener('click', () => {
          const cur = getLoggedInUser();
          if (cur) rememberCurrentAccount(cur);
          localStorage.removeItem('$user');
          location.href = '/member/login.html';
        });
      }
    };

    const refreshUserBar = () => {
      const user = getLoggedInUser();
      if (user) rememberCurrentAccount(user);
      const savedList = loadSavedAccounts();
      const bar = document.getElementById('brex-account-bar');
      const menu = document.getElementById('brex-account-menu');

      if (user) {
        bar.innerHTML = `
          <div class="brex-account-left">
            <span class="brex-dot"></span>
            <span class="brex-account-text">${xmlEscape(user.account || user.id)}</span>
            <span class="brex-account-muted">已登录</span>
          </div>
          <div class="brex-account-actions">
            <button type="button" id="brex-clear-cache" class="brex-ghost-btn" style="display:${cachedRawData ? 'inline-flex' : 'none'}">
              ${ICONS.refresh}
              <span>刷新</span>
            </button>
            <button type="button" id="brex-switch-btn" class="brex-ghost-btn">
              ${ICONS.switchUser}
              <span>切换账号</span>
            </button>
          </div>
        `;
        const clearBtn = document.getElementById('brex-clear-cache');
        if (clearBtn) {
          clearBtn.addEventListener('click', () => {
            cachedRawData = null;
            cachedOptionsKey = '';
            clearBtn.style.display = 'none';
            setStatus(0, '缓存已清除，下次导出将重新拉取');
          });
        }
      } else {
        bar.innerHTML = `
          <div class="brex-account-left">
            <span class="brex-dot warn"></span>
            <span class="brex-account-text">未登录</span>
          </div>
          <div class="brex-account-actions">
            ${savedList.length > 0 ? `<button type="button" id="brex-switch-btn" class="brex-ghost-btn">${ICONS.switchUser}<span>切换账号</span></button>` : ''}
            <a href="/member/login.html" class="brex-ghost-btn">前往登录</a>
          </div>
        `;
      }

      const switchBtn = document.getElementById('brex-switch-btn');
      if (switchBtn) {
        switchBtn.addEventListener('click', () => {
          const isOpen = menu.classList.contains('open');
          if (!isOpen) renderAccountMenu(getLoggedInUser());
          menu.classList.toggle('open', !isOpen);
        });
      }
      if (menu.classList.contains('open')) renderAccountMenu(user);
    };

    const renderStats = (summary) => {
      const el = document.getElementById('brex-summary-line');
      el.innerHTML =
        `<strong>${summary.totalOrders}</strong> 目 · ` +
        `<strong>${summary.totalFamilies}</strong> 科 · ` +
        `<strong>${summary.totalGenera}</strong> 属 · ` +
        `<span class="brex-accent-num">${summary.totalSpecies}</span> 种 · ` +
        `<strong>${summary.totalReports}</strong> 报告 · ` +
        `<strong>${summary.totalRecords}</strong> 记录`;
      el.classList.add('show');
    };

    const runExport = async () => {
      refreshUserBar();
      const user = getLoggedInUser();
      if (!user) {
        setStatus(0, '请先登录中国观鸟记录中心后再导出', true);
        return;
      }

      const format = document.getElementById('brex-format').value;
      const includeOutside = document.getElementById('brex-outside').checked;

      const exportBtn = document.getElementById('brex-export-btn');
      exportBtn.disabled = true;
      try {
        const startDate = normalizeUserDateInput(document.getElementById('brex-start').value);
        const endDate = normalizeUserDateInput(document.getElementById('brex-end').value);
        const optsKey = JSON.stringify({ user: user.id, startDate, endDate, includeOutside });

        if (!cachedRawData || cachedOptionsKey !== optsKey) {
          cachedRawData = await fetchAllUserData(
            { startDate, endDate, includeOutside },
            (pct, text) => setStatus(pct, text)
          );
          cachedOptionsKey = optsKey;
          refreshUserBar();
        } else {
          setStatus(96, '使用本次会话缓存生成文件');
        }

        const dataset = buildExportDataset({
          ...cachedRawData,
          sortOrder: 'asc',
          includeOutside,
        });

        renderStats(dataset.summary);

        if (format === 'xlsx') {
          const bytes = buildXlsxBytes(dataset);
          const blob = new Blob([bytes], {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          });
          triggerDownload(blob, buildFilename(dataset.summary.account, '郑四总鸟种与全量记录', 'xlsx'));
          setStatus(100, '已导出 Excel (.xlsx)');
        } else if (format === 'csv') {
          const csvSpecies = buildCsvString(SPECIES_COLUMNS, dataset.speciesTimeline);
          triggerDownload(
            new Blob([csvSpecies], { type: 'text/csv;charset=utf-8' }),
            buildFilename(dataset.summary.account, '郑四总鸟种首加时间线', 'csv')
          );
          await sleep(250);
          const csvRecords = buildCsvString(RECORD_COLUMNS, dataset.records);
          triggerDownload(
            new Blob([csvRecords], { type: 'text/csv;charset=utf-8' }),
            buildFilename(dataset.summary.account, '全部观鸟记录明细', 'csv')
          );
          await sleep(250);
          const csvReports = buildCsvString(REPORT_COLUMNS, dataset.reports);
          triggerDownload(
            new Blob([csvReports], { type: 'text/csv;charset=utf-8' }),
            buildFilename(dataset.summary.account, '观鸟报告汇总', 'csv')
          );
          setStatus(100, '已导出 3 份 UTF-8 CSV');
        } else if (format === 'json') {
          const jsonStr = JSON.stringify(dataset, null, 2);
          triggerDownload(
            new Blob([jsonStr], { type: 'application/json;charset=utf-8' }),
            buildFilename(dataset.summary.account, '全量观鸟数据备份', 'json')
          );
          setStatus(100, '已导出 JSON');
        }
      } catch (err) {
        console.error('[BirdReportExport]', err);
        setStatus(0, `导出失败：${err && err.message ? err.message : String(err)}`, true);
      } finally {
        exportBtn.disabled = false;
      }
    };

    document.getElementById('brex-export-btn').addEventListener('click', runExport);

    overlay._refreshUserBar = refreshUserBar;
  }

  function openModal() {
    injectStyles();
    createModalIfNeeded();
    const overlay = document.getElementById('brex-overlay');
    if (overlay._refreshUserBar) overlay._refreshUserBar();
    overlay.classList.add('open');
  }

  function mountFab() {
    if (window.self !== window.top) return;
    injectStyles();
    createModalIfNeeded();
    if (document.getElementById('brex-fab')) return;
    const btn = document.createElement('button');
    btn.id = 'brex-fab';
    btn.type = 'button';
    btn.innerHTML = `<span class="brex-fab-icon">${ICONS.download}</span><span>导出观鸟数据</span>`;
    btn.addEventListener('click', openModal);
    document.body.appendChild(btn);
  }

  global.__BIRDREPORT_EXPORTER__ = {
    openModal,
    mountFab,
    buildExportDataset,
    buildXlsxBytes,
    buildCsvString,
  };

  const init = () => {
    mountFab();
    if (global.__BREX_AUTO_OPEN__) openModal();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(typeof window !== 'undefined' ? window : globalThis);
