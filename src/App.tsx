import React from "react";
import { useEffect, useState } from "react";
import { Label, Select, Input, Button } from "./components";
import { AIProvider, ModelConfig, ScriptOption, ScriptRequest, GenerateResponse, OllamaModelInfo, CloudModelInfo, ProductVisualFacts } from "./types";
import { CLOUD_PROVIDER_PRESETS, getCloudProviderPreset } from "./cloudProviders";
import { Loader2, Copy, CheckCircle2, Sparkles, Video, Play, Type, Upload, X, Globe2, Cpu, Cloud, RefreshCw, Wifi, WifiOff, KeyRound, Download, RotateCcw, UserRound } from "lucide-react";

export const REGION_OPTIONS = [
  {
    id: "美区 (United States)",
    name: "🇺🇸 美区 (United States)",
    badge: "美式英语 · 快剪痛点反差 · TikTok热梗"
  },
  {
    id: "日区 (Japan)",
    name: "🇯🇵 日区 (Japan / 日本)",
    badge: "地道日语 · 隐私与收纳清洁 · QOL精致感"
  },
  {
    id: "泰区 (Thailand)",
    name: "🇹🇭 泰区 (Thailand / 泰国)",
    badge: "地道泰语 · 泰式幽默反转 · 防水防汗与COD货到付款"
  },
  {
    id: "马来西亚区 (Malaysia)",
    name: "🇲🇾 马来西亚区 (Malaysia)",
    badge: "马来语/Manglish · 多元文化包容 · 包邮与折扣券"
  },
  {
    id: "印尼区 (Indonesia)",
    name: "🇮🇩 印尼区 (Indonesia / 印尼)",
    badge: "印尼语爆款口癖 · 年轻庞大人口 · 极致性价比与COD"
  }
];

const AUDIENCE_BY_REGION: Record<string, string[]> = {
  "美区 (United States)": [
    "久坐上班族 / 居家办公者 (Desk workers / WFH)",
    "郊区宝妈 / 忙碌家庭主妇 (Suburban moms)",
    "Z世代大学生 / 宿舍党 (Gen Z college students)",
    "健身爱好者 / 运动达人 (Fitness enthusiasts)",
    "注重护肤的年轻女性 (Skincare lovers)",
    "养宠人士 / 铲屎官 (Pet owners)"
  ],
  "日区 (Japan)": [
    "通勤电车工薪族 / 职场OL (通勤電車通勤OL・サラリーマン)",
    "追求生活品质的独居单身族 (一人暮らし・QOL向上派)",
    "忙碌育儿的日本主妇 (忙しい子育てママ・主婦層)",
    "流行时尚年轻学生党 (Z世代の女子高生・大学生)",
    "极简收纳与清洁爱好者 (ミニマリスト・収納掃除好き)",
    "户外露营与自驾车主 (ソロキャンプ・ドライブ好き)"
  ],
  "泰区 (Thailand)": [
    "曼谷写字楼年轻白领 (พนักงานออฟฟิศในเมือง)",
    "摩托通勤族 / 大专学生族 (เด็กมหาลัย / ไรเดอร์มอเตอร์ไซค์)",
    "追求白皙透亮的爱美女生 (สาวๆ ที่รักความสวยความงาม)",
    "操持家务的新手宝妈 (คุณแม่ยุคใหม่)",
    "夜市/户外摊主与自由职业者 (พ่อค้าแม่ค้า / ฟรีแลนซ์)",
    "健身塑形与户外运动达人 (สายฟิตเนสและกิจกรรมกลางแจ้ง)"
  ],
  "马来西亚区 (Malaysia)": [
    "吉隆坡/槟城都市年轻白领 (Urban working executives)",
    "注重性价比的现代穆斯林家庭 (Keluarga Muslim moden)",
    "大专院校活跃网购学生党 (Gen Z campus online shoppers)",
    "每日骑摩托/开车的通勤族 (Daily motorcycle & car commuters)",
    "时尚美妆与清真护肤爱好者 (Beauty & Halal lifestyle lovers)",
    "全职居家宝妈 (Surirumah bergaya)"
  ],
  "印尼区 (Indonesia)": [
    "雅加达年轻都市打工族 (Karyawan muda Jakarta)",
    "活跃于TikTok的Z世代学生党 (Gen Z & Mahasiswa aktif)",
    "热衷网购的年轻时尚宝妈 (Ibu-ibu muda kekinian)",
    "注重防晒与清爽妆容的女生 (Pecinta skincare & makeup ringan)",
    "日常摩托通勤大军 (Pengendara motor harian)",
    "追求流行猎奇好物的小镇青年 (Remaja pemburu barang viral)"
  ]
};

const FEATURES_BY_REGION: Record<string, string[]> = {
  "美区 (United States)": [
    "TikTok Shop 限时 50% 折扣 + 美国本土包邮",
    "立竿见影：3秒速效，解决核心痛点，无效退款",
    "百万播放爆款同款，当前平台销量破 10 万+",
    "平价替代：拥有大牌质感，但只需三分之一的价格",
    "买一送一福利：使用视频专属折扣码立即享受"
  ],
  "日区 (Japan)": [
    "期間限定50%OFF + 全日本送料無料 (限时半价+全日包邮)",
    "圧倒的QOL向上：たった3秒で実感、効果なければ返品OK (3秒立竿见影，无效退款)",
    "TikTok/SNSで話題沸騰、累計10万個突破の人気爆発商品 (社媒爆款累销10万+)",
    "デパコス級の高見えプチプラ：高級品の1/3の価格で同等のクオリティ (大牌平替只需1/3价)",
    "1つ買うと1つ無料 (Buy 1 Get 1 Free)：動画限定クーポン配布中 (买一送一专属券)"
  ],
  "泰区 (Thailand)": [
    "ลดกระหน่ำ 50% + ส่งฟรีทั่วไทย + มีเก็บเงินปลายทาง (限时半价+全泰包邮+支持COD货到付款)",
    "เห็นผลทันทีใน 3 วินาที：แก้ปัญหาตรงจุด ไม่พอใจยินดีคืนเงิน (3秒速效解决痛点，无效退款)",
    "สินค้าไวรัลยอดวิวทะลุล้าน ยอดขายใน TikTok ทะลุแสนชิ้น (百万播放爆款同款，销量破10万)",
    "ตัวตายตัวแทนแบรนด์ดัง：คุณภาพพรีเมียมในราคาเพียง 1 ใน 3 (大牌平替三分之一价格)",
    "ซื้อ 1 แถม 1：กดโค้ดส่วนลดพิเศษเฉพาะในคลิปนี้เท่านั้น (买一送一专属折扣)"
  ],
  "马来西亚区 (Malaysia)": [
    "50% Off TikTok Shop + Free Shipping SM/SS + COD Available (半价优惠+全马包邮+支持货到付款)",
    "Kesan Seawal 3 Saat：Selesaikan Masalah Utama, Jaminan Wang Dikembalikan (3秒速效，无效退款)",
    "Barang Viral TikTok Terhangat, Jualan Melebihi 100K+ Unit (平台破10万销量爆款同款)",
    "Dupe Brand Mahal：Kualiti Mewah Dengan 1/3 Harga Sahaja (大牌质感只需1/3价)",
    "Beli 1 Percuma 1：Gunakan Kod Promo Eksklusif Video Ini (买一送一专属折扣码)"
  ],
  "印尼区 (Indonesia)": [
    "Diskon 50% + Gratis Ongkir Seluruh Indonesia + Bisa COD (半价折扣+全印尼包邮+支持COD)",
    "Khasiat Instan 3 Detik：Solusi Tepat Masalah, Garansi Uang Kembali (3秒见效，无效退款)",
    "Racun TikTok Viral Jutaan View, Terjual Lebih dari 100K+ (百万播放爆款同款，销量破10万)",
    "Dupe Brand Mewah：Kualitas Juara dengan Harga Sepertiganya (大牌平替只需三分之一价格)",
    "Beli 1 Gratis 1 (Buy 1 Get 1 Free)：Pakai Kupon Eksklusif di Video (买一送一专属券)"
  ]
};

const PRODUCT_CATEGORIES: Record<string, Record<string, string[]>> = {
  "美妆个护 (Beauty & Personal Care)": {
    "护肤 (Skincare)": ["深层清洁绿茶泥膜 (Green Tea Clay Mask)", "玻尿酸保湿精华 (Hyaluronic Acid Serum)", "视黄醇抗老面霜 (Retinol Night Cream)", "祛痘净肤贴 (Acne Pimple Patches)", "便携式补水喷雾 (Facial Mist)"],
    "彩妆 (Makeup)": ["无死角粉底刷套装 (Makeup Brush Set)", "持久防水眼线液 (Waterproof Eyeliner)", "丝绒雾面唇泥 (Matte Lip Clay)", "三色遮瑕盘 (Concealer Palette)", "控油定妆散粉 (Setting Powder)"],
    "美发护发 (Hair Care & Tools)": ["负离子吹风机 (Ionic Hair Dryer)", "自动卷发棒 (Auto Hair Curler)", "防脱发生发精华 (Hair Growth Serum)", "顺发气垫梳 (Detangling Brush)", "迷迭香护发精油 (Hair Oil)"],
    "身体护理 (Bath & Body)": ["去角质海盐身体乳 (Exfoliating Body Scrub)", "持久留香沐浴露 (Perfumed Body Wash)", "手足防裂霜 (Heel Balm)"],
    "口腔护理 (Oral Care)": ["超声波电动牙刷 (Electric Toothbrush)", "便携式冲牙器 (Water Flosser)", "紫瓶牙齿美白精华 (Teeth Whitening Serum)"],
    "男士理容 (Men's Grooming)": ["多功能电动剃须刀 (Electric Shaver)", "胡须修剪造型器 (Beard Trimmer)", "男士控油洗面奶 (Men's Face Wash)"],
    "美容仪器 (Beauty Tools)": ["微电流提拉美容仪 (Microcurrent Facial Device)", "LED红光理疗面罩 (LED Light Therapy Mask)", "黑头导出仪 (Blackhead Remover)"]
  },
  "家居与厨房 (Home & Kitchen)": {
    "厨房小家电 (Kitchen Appliances)": ["可视空气炸锅 (Air Fryer)", "单杯胶囊咖啡机 (Pod Coffee Maker)", "便携式迷你榨汁机 (Portable Blender)", "多功能电饭煲 (Rice Cooker)"],
    "厨具锅具 (Cookware & Bakeware)": ["不粘麦饭石煎锅 (Non-stick Frying Pan)", "硅胶厨具12件套 (Silicone Utensil Set)", "陶瓷烤盘套装 (Baking Dish Set)"],
    "烹饪工具 (Kitchen Gadgets)": ["多功能蔬菜切丝器 (Vegetable Chopper)", "不锈钢压蒜器 (Garlic Press)", "高精度厨房秤 (Digital Food Scale)", "电动胡椒研磨器 (Electric Pepper Grinder)"],
    "餐具与酒具 (Dining & Drinkware)": ["30oz大容量保温杯 (Insulated Tumbler)", "时间刻度吨吨桶 (Motivational Water Bottle)", "冷萃咖啡壶 (Cold Brew Maker)", "红酒醒酒器 (Wine Decanter)"],
    "家具靠垫 (Furniture & Cushions)": ["人体工学办公椅 (Ergonomic Chair)", "记忆棉护腰坐垫 (Memory Foam Cushion)", "懒人沙发 (Bean Bag Chair)", "电动升降桌 (Standing Desk)"],
    "家纺床品 (Bedding)": ["蚕丝抗皱枕套 (Silk Pillowcase)", "重力毯/减压毯 (Weighted Blanket)", "珊瑚绒保暖毛毯 (Fleece Throw Blanket)", "记忆棉慢回弹枕头 (Memory Foam Pillow)"],
    "卫浴用品 (Bath)": ["硅胶洗澡刷 (Silicone Body Scrubber)", "防滑吸水硅藻土垫 (Diatomite Bath Mat)", "高压过滤增压花洒 (Filtered Shower Head)"],
    "收纳整理 (Storage & Organization)": ["真空压缩收纳袋 (Vacuum Storage Bags)", "多层透明鞋盒 (Stackable Shoe Boxes)", "亚克力化妆品收纳盒 (Acrylic Makeup Organizer)", "水槽下双层置物架 (Under Sink Organizer)"],
    "清洁用品 (Cleaning Supplies)": ["静电除尘掸 (Duster)", "一次性马桶刷套装 (Disposable Toilet Brush)", "超细纤维清洁布 (Microfiber Cleaning Cloth)"],
    "室内环境 (Heating, Cooling & Air)": ["无叶低噪挂脖风扇 (Neck Fan)", "桌面迷你加湿器 (Mini Humidifier)", "负离子空气净化器 (Air Purifier)"]
  },
  "电子与数码 (Electronics & Tech)": {
    "手机配件 (Cell Phones & Accessories)": ["磁吸无线充电宝 (Magnetic Power Bank)", "防窥钢化膜 (Privacy Screen Protector)", "挂绳式手机壳 (Crossbody Phone Case)", "车载无线充电支架 (Car Mount Charger)"],
    "耳机与音频 (Headphones & Audio)": ["主动降噪蓝牙耳机 (Noise Cancelling Earbuds)", "RGB电竞游戏耳机 (Gaming Headset)", "防水迷你蓝牙音箱 (Waterproof Bluetooth Speaker)"],
    "智能穿戴 (Wearable Tech)": ["全天候健康监测智能手表 (Smart Watch)", "心率睡眠手环 (Fitness Tracker)"],
    "电脑与外设 (Computers & Accessories)": ["静音无线鼠标 (Wireless Mouse)", "铝合金笔记本折叠支架 (Laptop Stand)", "机械键盘清洁套装 (Keyboard Cleaning Kit)"],
    "摄影与直播 (Camera & Photo)": ["手机云台稳定器 (Gimbal Stabilizer)", "环形补光灯带三脚架 (Ring Light with Stand)", "运动相机胸带配件 (Action Camera Mount)"],
    "智能家居 (Smart Home)": ["智能语音插座 (Smart Plug)", "WiFi可视门铃 (Video Doorbell)", "智能安防摄像头 (Security Camera)"]
  },
  "服装鞋包 (Clothing, Shoes & Jewelry)": {
    "运动女装 (Women's Activewear)": ["高腰提臀无缝瑜伽裤 (Seamless Yoga Pants)", "防震交叉美背运动内衣 (Sports Bra)", "冰丝速干防晒服 (Sun Protection Jacket)"],
    "男士休闲 (Men's Clothing)": ["速干冷感运动T恤 (Dry Fit T-Shirt)", "多口袋工装短裤 (Cargo Shorts)", "防风防水冲锋衣 (Windbreaker)"],
    "舒适鞋靴 (Footwear)": ["厚底踩屎感拖鞋 (Cloud Slippers)", "轻便透气一脚蹬健步鞋 (Slip-on Walking Shoes)", "隐形增高减震鞋垫 (Height Increase Insoles)"],
    "箱包皮具 (Bags & Luggage)": ["大容量干湿分离旅行包 (Travel Duffel)", "防盗防水双肩电脑包 (Anti-Theft Backpack)", "RFID防盗刷极简钱包 (RFID Minimalist Wallet)"],
    "首饰手表 (Jewelry & Watches)": ["钛钢极简冷淡风项链 (Minimalist Necklace)", "防过敏莫桑石耳钉 (Moissanite Studs)"],
    "塑形内衣 (Lingerie & Shapewear)": ["无痕收腹提臀裤 (Shapewear Bodysuit)", "隐形无肩带胸贴 (Sticky Bra)"]
  },
  "户外运动 (Sports & Outdoors)": {
    "健身器材 (Fitness Gear)": ["智能计数无绳跳绳 (Cordless Jump Rope)", "5件套乳胶阻力带 (Resistance Bands Set)", "自动回弹健腹轮 (Ab Roller)"],
    "户外露营 (Camping & Hiking)": ["秒开防晒液压帐篷 (Pop-up Tent)", "超轻折叠露营椅 (Folding Camp Chair)", "户外高亮强光手电筒 (LED Flashlight)", "便携式户外睡袋 (Sleeping Bag)"],
    "运动护具 (Protective Gear)": ["硅胶减震透气护膝 (Knee Brace)", "举重防滑半指手套 (Weightlifting Gloves)"],
    "水上运动 (Water Sports)": ["速干冷感运动毛巾 (Cooling Towel)", "全干式浮潜面罩 (Snorkel Mask)", "防水手机袋 (Waterproof Phone Pouch)"],
    "骑行装备 (Cycling)": ["高亮自行车前灯尾灯套装 (Bike Light Set)", "记忆棉自行车坐垫套 (Bike Seat Cover)"]
  },
  "健康与家庭 (Health & Household)": {
    "按摩放松 (Massage & Relaxation)": ["人体工学颈部按摩仪 (Neck Massager)", "迷你便携筋膜枪 (Mini Massage Gun)", "石墨烯加热护膝垫 (Heating Knee Pad)", "蒸汽热敷眼罩 (Steam Eye Mask)"],
    "健康监测 (Health Monitors)": ["高精度体脂秤 (Smart Body Fat Scale)", "家用手腕式电子血压计 (Wrist Blood Pressure Monitor)", "指夹式血氧仪 (Pulse Oximeter)"],
    "日常护理 (First Aid & Care)": ["透明防水创可贴 (Waterproof Bandages)", "纯棉一次性洗脸巾 (Disposable Face Towel)"],
    "营养保健 (Vitamins & Supplements)": ["褪黑素睡眠软糖 (Melatonin Gummies)", "深海鱼油胶囊 (Fish Oil Capsules)"]
  },
  "工具与家装 (Tools & Home Improvement)": {
    "电动工具 (Power Tools)": ["20V无绳冲击电钻 (Cordless Drill)", "多功能迷你电动螺丝刀 (Electric Screwdriver)"],
    "手动工具 (Hand Tools)": ["家用维修100件套工具箱 (Tool Kit)", "多功能折叠瑞士军刀 (Multitool)"],
    "灯具照明 (Lighting)": ["橱柜人体感应灯 (Motion Sensor Cabinet Light)", "LED音乐律动灯带 (LED Strip Lights)", "户外太阳能感应庭院灯 (Solar Garden Lights)"],
    "五金与卫浴 (Hardware & Plumbing)": ["带抓手下水道疏通器 (Drain Snake)", "自粘仿真大理石墙纸 (Peel and Stick Wallpaper)", "防水防霉美缝贴 (Caulk Strip)"],
    "安全安防 (Safety & Security)": ["隐藏式保险箱 (Diversion Safe)", "门窗防盗报警器 (Window Alarm)"]
  },
  "宠物用品 (Pet Supplies)": {
    "狗用具 (Dogs)": ["耐咬漏食发声狗玩具 (Chew Toy for Dogs)", "防爆冲反光牵引绳 (No Pull Dog Harness)", "车载宠物防脏垫 (Car Seat Cover)", "防水舒缓狗床 (Calming Dog Bed)"],
    "猫用具 (Cats)": ["全封闭式防臭猫砂盆 (Covered Litter Box)", "自嗨解闷猫薄荷鱼 (Catnip Fish Toy)", "多层猫爬架 (Cat Tree)", "防漏砂猫砂垫 (Cat Litter Mat)"],
    "智能喂养 (Smart Feeding)": ["宠物自动循环过滤饮水机 (Pet Water Fountain)", "APP定时定量智能喂食器 (Smart Automatic Feeder)"],
    "日常清洁 (Grooming)": ["宠物一键去浮毛梳 (Self-Cleaning Slicker Brush)", "可撕式粘毛滚筒 (Lint Roller)", "宠物专用湿巾 (Pet Wipes)"]
  },
  "母婴用品 (Baby & Maternity)": {
    "喂养用品 (Feeding)": ["防胀气仿母乳硅胶奶瓶 (Silicone Baby Bottle)", "婴儿恒温辅食吸盘碗 (Warming Suction Bowl)", "防漏婴儿吸管杯 (Sippy Cup)"],
    "洗护尿布 (Bath & Diapering)": ["无泪配方婴儿洗发沐浴露 (Baby Wash)", "大容量防臭尿布桶 (Diaper Pail)"],
    "婴儿出行 (Travel & Gear)": ["多功能大容量妈咪包 (Diaper Bag Backpack)", "防走失牵引绳手环 (Toddler Leash)", "多功能婴儿推车挂钩 (Stroller Hooks)"],
    "安抚睡眠 (Nursery)": ["白噪音婴儿安抚助眠仪 (Baby Sound Machine)", "纯棉婴儿安抚巾 (Security Blanket)"]
  },
  "玩具与游戏 (Toys & Games)": {
    "益智早教 (Educational Toys)": ["大颗粒磁力片积木 (Magnetic Tiles)", "蒙特梭利木制早教玩具 (Montessori Wooden Toys)"],
    "解压玩具 (Fidget Toys)": ["灭鼠先锋捏捏乐 (Pop It Fidget Toy)", "减压无限魔方 (Infinity Cube)"],
    "户外玩具 (Outdoor Play)": ["全自动加特林泡泡机 (Gatling Bubble Machine)", "儿童可折叠发光滑板车 (Kids Scooter)"],
    "桌游与拼图 (Board Games & Puzzles)": ["家庭聚会互动桌游 (Party Board Game)", "成人1000件风景拼图 (1000 Piece Puzzle)"],
    "毛绒公仔 (Stuffed Animals)": ["翻面情绪章鱼毛绒玩具 (Reversible Octopus Plush)", "长条大鹅安抚抱枕 (Giant Goose Plush)"]
  },
  "汽车用品 (Automotive)": {
    "内饰配件 (Interior Accessories)": ["多功能汽车座椅后背收纳袋 (Car Seat Organizer)", "汽车中控台清洁软胶 (Cleaning Gel)", "防晒隔热挡风玻璃伞 (Windshield Sun Shade)"],
    "车载电器 (Car Electronics)": ["便携式车载无线充气泵 (Portable Tire Inflator)", "车载大吸力迷你吸尘器 (Car Vacuum)", "数显多口车载快充 (Car Charger)"],
    "外观与养护 (Exterior & Care)": ["汽车漆面划痕修复膏 (Car Scratch Remover)", "超细纤维洗车毛巾 (Microfiber Car Wash Towel)"]
  },
  "办公与文具 (Office Products)": {
    "桌面收纳 (Desk Accessories)": ["RGB超大发光鼠标垫 (RGB Mouse Pad)", "隐形桌面底挂式理线器 (Cable Management Tray)", "大容量帆布笔袋 (Large Pencil Case)"],
    "手账文具 (Stationery)": ["彩色护眼荧光笔套装 (Highlighter Set)", "自律日程规划笔记本 (Planner Notebook)", "便签贴纸盲盒 (Sticky Notes)"],
    "人体工学 (Office Ergonomics)": ["护腕记忆棉鼠标垫 (Wrist Rest Mouse Pad)", "可调节电脑显示器增高架 (Monitor Stand)"]
  },
  "节庆与派对 (Party & Festival)": {
    "节日装饰 (Decorations)": ["万圣节南瓜氛围灯 (Halloween Lights)", "圣诞节倒数日历盲盒 (Advent Calendar)", "LED带灯发光气球 (LED Balloons)"],
    "派对用品 (Party Supplies)": ["一次性烫金生日餐具套装 (Gold Foil Tableware)", "生日派对搞怪拍照道具 (Photo Booth Props)"]
  }
};

const DURATION_OPTIONS = [
  "10秒 (极限短平快/极速促单)",
  "15秒 (极速引流/强视觉)",
  "20-30秒 (标准爆款展示)",
  "45秒 (深度痛点解析)",
  "60秒 (完整沉浸式评测)"
];

export default function App({ initialSettings = {} }: { initialSettings?: any }) {
  const commercialMode = import.meta.env.MODE === "commercial";
  const [mainCategory, setMainCategory] = useState(Object.keys(PRODUCT_CATEGORIES)[0]);
  const [subCategory, setSubCategory] = useState(Object.keys(PRODUCT_CATEGORIES[Object.keys(PRODUCT_CATEGORIES)[0]])[0]);
  const [isCustomProduct, setIsCustomProduct] = useState(false);

  const defaultRegion = REGION_OPTIONS[0].id;
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<ScriptRequest>({
    region: defaultRegion,
    product: PRODUCT_CATEGORIES[Object.keys(PRODUCT_CATEGORIES)[0]][Object.keys(PRODUCT_CATEGORIES[Object.keys(PRODUCT_CATEGORIES)[0]])[0]][0],
    targetAudience: AUDIENCE_BY_REGION[defaultRegion][0],
    features: FEATURES_BY_REGION[defaultRegion][0],
    duration: DURATION_OPTIONS[2],
  });
  const [scripts, setScripts] = useState<ScriptOption[]>([]);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  // 脚本生成模型：只负责 Hook / 分镜 / 配音 / CTA，不再强制承担看图任务。
  const [modelConfig, setModelConfig] = useState<ModelConfig>(initialSettings.modelConfig || {
    provider: "ollama",
    baseUrl: "http://127.0.0.1:11434",
    model: "",
    apiKey: "",
    cloudProviderId: "openai",
    inputMode: "text",
  });

  // 图片识别模型：单独负责读取产品图并产出“视觉事实”。
  // 默认与脚本模型分开，避免 Qwen3-VL Thinking 这类视觉模型被迫继续输出严格脚本 JSON。
  const [useSameModelForVision, setUseSameModelForVision] = useState(initialSettings.useSameModelForVision ?? false);
  const [visionModelConfig, setVisionModelConfig] = useState<ModelConfig>(initialSettings.visionModelConfig || {
    provider: "ollama",
    baseUrl: "http://127.0.0.1:11434",
    model: "",
    apiKey: "",
    cloudProviderId: "openai",
    inputMode: "multimodal",
  });

  const [ollamaModels, setOllamaModels] = useState<string[]>([]);
  const [ollamaModelInfos, setOllamaModelInfos] = useState<OllamaModelInfo[]>([]);
  const [cloudModels, setCloudModels] = useState<CloudModelInfo[]>([]);
  const [cloudModelsLoading, setCloudModelsLoading] = useState(false);

  const [visionOllamaModels, setVisionOllamaModels] = useState<string[]>([]);
  const [visionOllamaModelInfos, setVisionOllamaModelInfos] = useState<OllamaModelInfo[]>([]);
  const [visionCloudModels, setVisionCloudModels] = useState<CloudModelInfo[]>([]);
  const [visionCloudModelsLoading, setVisionCloudModelsLoading] = useState(false);
  const [visionUseCustomCloudModelInput, setVisionUseCustomCloudModelInput] = useState(false);
  const [visionModelChecking, setVisionModelChecking] = useState(false);
  const [visionModelStatus, setVisionModelStatus] = useState<{ ok: boolean; message: string } | null>(null);

  const [modelChecking, setModelChecking] = useState(false);
  const [modelStatus, setModelStatus] = useState<{ ok: boolean; message: string } | null>(null);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [generationStep, setGenerationStep] = useState(0);
  const [useCustomCloudModelInput, setUseCustomCloudModelInput] = useState(false);
  const [visualFacts, setVisualFacts] = useState<ProductVisualFacts | null>(null);
  const [desktopVersion, setDesktopVersion] = useState<string>("");
  const [updateStatus, setUpdateStatus] = useState<{ state: string; message?: string; version?: string; percent?: number } | null>(null);
  const [account, setAccount] = useState<{ id: string; email: string; credits: number } | null>(null);
  const [accountToken, setAccountToken] = useState("");
  const [accountOpen, setAccountOpen] = useState(false);
  const [accountMode, setAccountMode] = useState<"login" | "register">("login");
  const [accountEmail, setAccountEmail] = useState("");
  const [accountPassword, setAccountPassword] = useState("");
  const [accountBusy, setAccountBusy] = useState(false);
  const [accountError, setAccountError] = useState("");

  useEffect(() => {
    if (!window.tkDesktop) return;
    window.tkDesktop.saveSettings({ modelConfig, visionModelConfig, useSameModelForVision }).catch(error => setModelStatus({ ok: false, message: '配置保存失败：' + error.message }));
  }, [modelConfig, visionModelConfig, useSameModelForVision]);

  const effectiveVisionModelConfig = useSameModelForVision ? modelConfig : visionModelConfig;
  const selectedModelSupportsImage = useSameModelForVision
    ? modelConfig.inputMode === "multimodal"
    : Boolean(visionModelConfig.model) && visionModelConfig.inputMode === "multimodal";

  useEffect(() => {
    if (!window.tkDesktop) return;
    window.tkDesktop.getVersion().then(setDesktopVersion).catch(() => {});
    const off = window.tkDesktop.onUpdateStatus((payload) => setUpdateStatus(payload));
    return off;
  }, []);

  const handleDesktopUpdateAction = async () => {
    if (!window.tkDesktop) return;
    const state = updateStatus?.state;
    if (state === "available") return window.tkDesktop.downloadUpdate();
    if (state === "downloaded") return window.tkDesktop.installUpdate();
    return window.tkDesktop.checkForUpdates();
  };

  const submitAccount = async (event: React.FormEvent) => {
    event.preventDefault();
    setAccountBusy(true); setAccountError("");
    try {
      const response = await fetch(`/api/account/${accountMode === "login" ? "login" : "register"}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: accountEmail, password: accountPassword }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "账户操作失败");
      setAccountToken(data.token); setAccount(data.user); setAccountOpen(false); setAccountPassword("");
    } catch (error: any) { setAccountError(error.message || "账户操作失败"); }
    finally { setAccountBusy(false); }
  };

  useEffect(() => {
    if (!loading) {
      setElapsedSeconds(0);
      return;
    }
    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [loading]);

  const loadOllamaModels = async (silent = false) => {
    if (!silent) setModelChecking(true);
    try {
      const response = await fetch(`/api/models?provider=ollama&baseUrl=${encodeURIComponent(modelConfig.baseUrl || "http://127.0.0.1:11434")}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "无法连接 Ollama");
      const models: string[] = data.models || [];
      const infos: OllamaModelInfo[] = Array.isArray(data.modelInfos) ? data.modelInfos : models.map((name) => ({ name, capabilities: [], vision: /vl/i.test(name), thinking: false, dedicatedThinking: /thinking/i.test(name), instruct: /instruct/i.test(name), recommended: !/thinking/i.test(name) }));
      setOllamaModels(models);
      setOllamaModelInfos(infos);
      setModelConfig((prev) => {
        if (models.includes(prev.model)) return prev;
        const preferred =
          infos.find((m) => !m.vision && m.instruct && m.recommended) ||
          infos.find((m) => !m.vision && m.recommended) ||
          infos.find((m) => m.instruct && m.recommended) ||
          infos.find((m) => m.recommended) ||
          infos[0];
        return { ...prev, model: preferred?.name || "" };
      });

      // 同一台本地 Ollama 也可直接给视觉模型列表使用。
      setVisionOllamaModels(models);
      setVisionOllamaModelInfos(infos);
      setVisionModelConfig((prev) => {
        if (prev.provider !== "ollama" || models.includes(prev.model)) return prev;
        const preferredVision = infos.find((m) => m.vision) || infos.find((m) => /vl|vision/i.test(m.name)) || infos[0];
        return { ...prev, baseUrl: modelConfig.baseUrl || "http://127.0.0.1:11434", model: preferredVision?.name || "", inputMode: "multimodal" };
      });

      setModelStatus({ ok: true, message: models.length ? `Ollama 已连接 · ${models.length} 个本地模型` : "Ollama 已连接，但还没有安装模型" });
    } catch (error: any) {
      setOllamaModels([]);
      setModelStatus({ ok: false, message: error.message || "无法连接 Ollama" });
    } finally {
      if (!silent) setModelChecking(false);
    }
  };


  const loadVisionOllamaModels = async (silent = false) => {
    if (!silent) setVisionModelChecking(true);
    try {
      const baseUrl = visionModelConfig.baseUrl || "http://127.0.0.1:11434";
      const response = await fetch(`/api/models?provider=ollama&baseUrl=${encodeURIComponent(baseUrl)}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "无法连接视觉 Ollama");
      const models: string[] = data.models || [];
      const infos: OllamaModelInfo[] = Array.isArray(data.modelInfos)
        ? data.modelInfos
        : models.map((name) => ({
            name,
            capabilities: [],
            vision: /vl|vision/i.test(name),
            thinking: false,
            dedicatedThinking: /thinking/i.test(name),
            instruct: /instruct/i.test(name),
            recommended: true,
          }));
      setVisionOllamaModels(models);
      setVisionOllamaModelInfos(infos);
      setVisionModelConfig((prev) => {
        if (models.includes(prev.model)) return prev;
        const preferred = infos.find((m) => m.vision) || infos.find((m) => /vl|vision/i.test(m.name)) || infos[0];
        return { ...prev, model: preferred?.name || "", inputMode: "multimodal" };
      });
      if (!silent) setVisionModelStatus({ ok: true, message: models.length ? `视觉 Ollama 已连接 · ${models.length} 个模型` : "Ollama 已连接，但没有安装模型" });
    } catch (error: any) {
      setVisionOllamaModels([]);
      if (!silent) setVisionModelStatus({ ok: false, message: error.message || "无法连接视觉 Ollama" });
    } finally {
      if (!silent) setVisionModelChecking(false);
    }
  };

  const selectVisionCloudProvider = (providerId: string) => {
    const preset = getCloudProviderPreset(providerId);
    const fallbackModels = (preset.fallbackModels || []).map((id) => ({ id, name: id } as CloudModelInfo));
    setVisionCloudModels(fallbackModels);
    setVisionUseCustomCloudModelInput(false);
    setVisionModelConfig({
      provider: preset.transport as AIProvider,
      cloudProviderId: preset.id,
      baseUrl: preset.baseUrl,
      model: fallbackModels[0]?.id || "",
      apiKey: "",
      inputMode: "multimodal",
    });
    setVisionModelStatus(null);
    setVisualFacts(null);
  };

  const loadVisionCloudModels = async (silent = false) => {
    if (visionModelConfig.provider === "ollama") return;
    if (!silent) setVisionCloudModelsLoading(true);
    try {
      const response = await fetch("/api/cloud-models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(visionModelConfig),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || "读取视觉模型列表失败");
      const models: CloudModelInfo[] = Array.isArray(data?.models) ? data.models : [];
      setVisionCloudModels(models);
      setVisionModelConfig((prev) => {
        if (models.some((m) => m.id === prev.model)) return prev;
        return { ...prev, model: models[0]?.id || prev.model, inputMode: "multimodal" };
      });
      if (!silent) setVisionModelStatus({ ok: true, message: models.length ? `已读取 ${models.length} 个视觉模型候选` : "平台没有返回模型列表，可手动输入模型 ID" });
    } catch (error: any) {
      if (!silent) setVisionModelStatus({ ok: false, message: error.message || "读取视觉模型列表失败" });
    } finally {
      if (!silent) setVisionCloudModelsLoading(false);
    }
  };

  const testVisionModelConnection = async () => {
    const config = useSameModelForVision ? { ...modelConfig, inputMode: "multimodal" as const } : visionModelConfig;
    if (!config.model) {
      setVisionModelStatus({ ok: false, message: "请先选择图片识别模型" });
      return;
    }
    if (config.provider !== "ollama" && !config.apiKey) {
      setVisionModelStatus({ ok: false, message: "请先填写图片识别模型的 API Key" });
      return;
    }
    setVisionModelChecking(true);
    setVisionModelStatus(null);
    try {
      const response = await fetch("/api/test-model", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || "视觉模型连接失败");
      if (Array.isArray(data.models) && config.provider === "ollama") {
        setVisionOllamaModels(data.models);
        if (Array.isArray(data.modelInfos)) setVisionOllamaModelInfos(data.modelInfos);
      }
      if (Array.isArray(data.cloudModels) && config.provider !== "ollama") {
        setVisionCloudModels(data.cloudModels);
      }
      setVisionModelStatus({ ok: true, message: `视觉模型 ${config.model} 可连接。真正的图片能力会在上传图片后由识别步骤验证。` });
    } catch (error: any) {
      setVisionModelStatus({ ok: false, message: error.message || "视觉模型连接失败" });
    } finally {
      setVisionModelChecking(false);
    }
  };

  const selectCloudProvider = (providerId: string) => {
    const preset = getCloudProviderPreset(providerId);
    const fallbackModels = (preset.fallbackModels || []).map((id) => ({ id, name: id } as CloudModelInfo));
    setCloudModels(fallbackModels);
    setUseCustomCloudModelInput(false);
    setModelConfig({
      provider: preset.transport as AIProvider,
      cloudProviderId: preset.id,
      baseUrl: preset.baseUrl,
      model: fallbackModels[0]?.id || "",
      apiKey: "",
      inputMode: "text",
    });
    setModelStatus(null);
  };

  const loadCloudModels = async (silent = false) => {
    if (modelConfig.provider === "ollama") return;
    if (!silent) setCloudModelsLoading(true);
    try {
      const response = await fetch("/api/cloud-models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(modelConfig),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || "读取云端模型列表失败");
      const models: CloudModelInfo[] = Array.isArray(data?.models) ? data.models : [];
      setCloudModels(models);
      setModelConfig((prev) => {
        if (models.some((m) => m.id === prev.model)) return prev;
        return { ...prev, model: models[0]?.id || prev.model };
      });
      if (!silent) setModelStatus({ ok: true, message: models.length ? `已读取 ${models.length} 个当前可用模型` : "该平台没有返回模型列表，可手动输入模型 ID" });
    } catch (error: any) {
      if (!silent) setModelStatus({ ok: false, message: error.message || "读取模型列表失败" });
    } finally {
      if (!silent) setCloudModelsLoading(false);
    }
  };

  const testModelConnection = async () => {
    setModelChecking(true);
    setModelStatus(null);
    try {
      const response = await fetch("/api/test-model", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(modelConfig),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "连接失败");
      if (Array.isArray(data.models)) {
        const infos: OllamaModelInfo[] = Array.isArray(data.modelInfos) ? data.modelInfos : [];
        setOllamaModels(data.models);
        setOllamaModelInfos(infos);
        setModelConfig((prev) => {
          if (data.models.includes(prev.model)) return prev;
          const preferred = infos.find((m) => m.instruct && m.recommended) || infos.find((m) => m.recommended);
          return { ...prev, model: preferred?.name || data.models[0] || "" };
        });
      }
      if (Array.isArray(data.cloudModels)) {
        setCloudModels(data.cloudModels);
        setModelConfig((prev) => data.cloudModels.some((m: any) => m.id === prev.model) ? prev : { ...prev, model: data.cloudModels[0]?.id || prev.model });
      }
      setModelStatus({ ok: true, message: data.message || "模型服务已连接" });
    } catch (error: any) {
      setModelStatus({ ok: false, message: error.message || "连接失败" });
    } finally {
      setModelChecking(false);
    }
  };

  useEffect(() => {
    if (modelConfig.provider === "ollama") loadOllamaModels(true);
  }, [modelConfig.provider]);

  useEffect(() => {
    if (!useSameModelForVision && visionModelConfig.provider === "ollama") loadVisionOllamaModels(true);
  }, [useSameModelForVision, visionModelConfig.provider]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!selectedModelSupportsImage) {
      alert("请先配置图片识别模型；如果选择“与脚本使用同一个模型”，请确认该模型支持图片。");
      e.currentTarget.value = "";
      return;
    }
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert("图片不能超过 5MB");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setVisualFacts(null);
        setFormData({ ...formData, image: reader.result as string, visualFacts: undefined });
      };
      reader.readAsDataURL(file);
    }
  };

  const explainGenerationFailure = (error: any) => {
    if (error?.name === "AbortError") {
      return `脚本模型 ${modelConfig.model} 长时间没有返回结果，本次请求已停止。可能原因：模型服务繁忙、模型已不可用，或当前账号没有调用权限。建议先点击“测试模型连接”或“读取当前模型”，也可以换一个模型再试。`;
    }
    const raw = String(error?.message || "");
    const lower = raw.toLowerCase();
    if (raw.includes("产品图片识别阶段失败") || raw.includes("图片识别模型")) {
      return raw;
    }
    if (/404|410|not found|does not exist|deprecated|retired|decommission|no longer available|invalid model/.test(lower)) {
      return `脚本模型 ${modelConfig.model} 当前无法调用。它可能已经下线、改名、被服务商移除，或者你的账号没有这个模型的权限。建议点击“读取当前模型”刷新列表；如果列表里仍然存在但持续失败，请改用服务商控制台当前推荐的模型。\n\n原始信息：${raw}`;
    }
    if (/401|403|unauthorized|forbidden|permission|api key|authentication/.test(lower)) {
      return `当前 API Key 无法调用脚本模型 ${modelConfig.model}。请检查 API Key、账号权限、地区节点以及该模型是否已经开通。\n\n原始信息：${raw}`;
    }
    if (/429|rate limit|too many requests|quota/.test(lower)) {
      return `脚本模型 ${modelConfig.model} 当前触发限流或额度限制。请稍等后重试，或检查服务商账户余额 / 配额。\n\n原始信息：${raw}`;
    }
    if (/image|vision|multimodal|unsupported content|content type/.test(lower)) {
      return `你把当前模型设置成了“多模态 / 支持图片”，但服务商拒绝了图片输入。请确认当前图片识别模型 是否真的支持图片；如果它是纯文本模型，请切换为“纯文本”后重新生成。\n\n原始信息：${raw}`;
    }
    if (/empty|空内容|没有返回|no content|no output/.test(lower)) {
      return `脚本模型 ${modelConfig.model} 已收到请求，但没有返回可用内容。它可能已经不再可用、服务端暂时异常，或该模型与当前接口不兼容。建议先“测试模型连接”，再“读取当前模型”刷新列表；仍失败就更换模型。\n\n原始信息：${raw}`;
    }
    if (/500|502|503|504|overloaded|unavailable|busy|timeout/.test(lower)) {
      return `模型服务暂时不可用或过载，当前脚本模型：${modelConfig.model}。这不一定是你的配置错误，可以稍后重试；如果持续出现，请刷新模型列表并确认该模型是否仍在服务。\n\n原始信息：${raw}`;
    }
    return raw || `脚本模型 ${modelConfig.model} 调用失败。请测试连接、刷新模型列表，或改用其他模型。`;
  };

  const analyzeProductImageBeforeGeneration = async (): Promise<ProductVisualFacts | undefined> => {
    if (!formData.image) return undefined;
    const visionConfig: ModelConfig = useSameModelForVision
      ? { ...modelConfig, inputMode: "multimodal" }
      : { ...visionModelConfig, inputMode: "multimodal" };

    if (!commercialMode && !visionConfig.model) throw new Error("请先选择图片识别模型。");
    if (!commercialMode && visionConfig.provider !== "ollama" && !visionConfig.apiKey) throw new Error("请先填写图片识别模型的 API Key。");

    setGenerationStep(-1);
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 100000);
    try {
      const response = await fetch("/api/analyze-product-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({ ...formData, visualFacts: undefined, modelConfig: visionConfig }),
      });
      const data: any = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || `产品图片识别失败（HTTP ${response.status}）`);
      const facts = data?.visualFacts as ProductVisualFacts | undefined;
      if (!facts || typeof facts !== "object") throw new Error("模型没有返回有效的产品视觉事实。");
      setVisualFacts(facts);
      return facts;
    } catch (error: any) {
      const visionName = useSameModelForVision ? modelConfig.model : visionModelConfig.model;
      if (error?.name === "AbortError") throw new Error(`图片识别模型 ${visionName} 超过 100 秒没有返回，已停止。脚本尚未生成，请换一个更快的视觉模型后重试。`);
      throw new Error(`产品图片识别阶段失败（视觉模型：${visionName}），脚本尚未开始生成。${error?.message || error}`);
    } finally {
      window.clearTimeout(timeout);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.product || !formData.targetAudience || !formData.features) return;
    if (!commercialMode && !modelConfig.model) {
      alert(modelConfig.provider === "ollama" ? "请先选择一个 Ollama 模型" : "请输入云端模型名称");
      return;
    }
    if (!commercialMode && modelConfig.provider !== "ollama" && !modelConfig.apiKey) {
      alert("请输入云端 API Key");
      return;
    }

    if (formData.image) {
      if (!commercialMode && !useSameModelForVision && !visionModelConfig.model) {
        setGenerationError("已经上传产品图片，但尚未选择图片识别模型。请先配置视觉模型。");
        return;
      }
      if (!commercialMode && !useSameModelForVision && visionModelConfig.provider !== "ollama" && !visionModelConfig.apiKey) {
        setGenerationError("图片识别模型使用云端 API，请先填写视觉模型的 API Key。");
        return;
      }
      if (!commercialMode && useSameModelForVision && modelConfig.inputMode !== "multimodal") {
        setGenerationError("你选择了“视觉与脚本使用同一个模型”，请确认该模型支持图片，并把同模型图片能力设为“支持图片”。");
        return;
      }
    }

    setLoading(true);
    setGenerationError(null);
    setScripts([]);
    setGenerationStep(0);

    try {
      const facts = await analyzeProductImageBeforeGeneration();

      // 脚本模型只接收已经锁定的视觉事实，不再重复接收原始图片。
      // 这样 Qwen3-VL Thinking 可以专心看图，qwen3.5 / Kimi / Claude 等文本模型专心写脚本。
      const requestData: ScriptRequest = { ...formData, image: undefined, visualFacts: facts };
      setGenerationStep(0);

      if (modelConfig.provider === "ollama") {
        // True progress: generate one local script per request, then immediately keep it.
        const styles = ["UGC 真实评测", "POV 第一视角", "Viral Demo 强视觉演示"];
        const completed: ScriptOption[] = [];
        for (let i = 0; i < 3; i++) {
          setGenerationStep(i + 1);
          const controller = new AbortController();
          const timeout = window.setTimeout(() => controller.abort(), 130000);
          try {
            const response = await fetch("/api/generate-one", {
              method: "POST",
              headers: { "Content-Type": "application/json", ...(accountToken ? { Authorization: `Bearer ${accountToken}` } : {}) },
              signal: controller.signal,
              body: JSON.stringify({ ...requestData, modelConfig, index: i + 1, style: styles[i] }),
            });
            const data: any = await response.json().catch(() => null);
            if (!response.ok) throw new Error(data?.error || `第 ${i + 1} 套生成失败（HTTP ${response.status}）`);
            const item = data?.script;
            if (!item || !Array.isArray(item.script) || !item.script.length) throw new Error(`第 ${i + 1} 套没有返回有效分镜`);
            const safe: ScriptOption = {
              title: String(item.title || `方案 ${i + 1}`),
              style: String(item.style || styles[i]),
              hook: String(item.hook || "前三秒钩子"),
              cta: String(item.cta || "点击 TikTok Shop 查看当前优惠。"),
              script: item.script.map((scene: any, sceneIndex: number) => ({
                timestamp: String(scene?.timestamp ?? `${sceneIndex * 2}-${sceneIndex * 2 + 2}s`),
                visual: String(scene?.visual ?? "画面描述缺失"),
                audio: String(scene?.audio ?? "配音内容缺失"),
              })),
            };
            completed.push(safe);
            setScripts([...completed]);
          } finally {
            window.clearTimeout(timeout);
          }
        }
      } else {
        const controller = new AbortController();
        const clientTimeout = window.setTimeout(() => controller.abort(), 130000);
        try {
          const response = await fetch("/api/generate", {
            method: "POST",
            headers: { "Content-Type": "application/json", ...(accountToken ? { Authorization: `Bearer ${accountToken}` } : {}) },
            signal: controller.signal,
            body: JSON.stringify({ ...requestData, modelConfig }),
          });
          const data: any = await response.json().catch(() => null);
          if (!response.ok) throw new Error(data?.error || `生成脚本失败（HTTP ${response.status}）`);
          if (!data || !Array.isArray(data.scripts)) throw new Error("AI 返回的数据格式异常：没有收到有效的脚本数组。");
          const safeScripts: ScriptOption[] = data.scripts.filter((item: any) => item && typeof item === "object").map((item: any, index: number) => ({
            title: typeof item.title === "string" ? item.title : `方案 ${index + 1}`,
            style: typeof item.style === "string" ? item.style : "创作者风格",
            hook: typeof item.hook === "string" ? item.hook : "前三秒钩子",
            cta: typeof item.cta === "string" ? item.cta : "点击 TikTok Shop 查看当前优惠。",
            script: Array.isArray(item.script) ? item.script.map((scene: any, sceneIndex: number) => ({ timestamp: String(scene?.timestamp ?? `${sceneIndex * 2}-${sceneIndex * 2 + 2}s`), visual: String(scene?.visual ?? "画面描述缺失"), audio: String(scene?.audio ?? "配音内容缺失") })) : [],
          })).filter((item: ScriptOption) => item.script.length > 0).slice(0, 3);
          if (!safeScripts.length) throw new Error("AI 已返回内容，但没有可显示的有效分镜。请重试或更换模型。");
          setScripts(safeScripts);
        } finally {
          window.clearTimeout(clientTimeout);
        }
      }
    } catch (error: any) {
      console.error("Generate failed:", error);
      setGenerationError(explainGenerationFailure(error));
    } finally {
      setGenerationStep(0);
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const formatScriptForClipboard = (script: ScriptOption) => {
    let text = `【目标区域】${formData.region}\n【标题】${script.title}\n【风格】${script.style}\n【钩子解析】${script.hook}\n\n【详细脚本】\n`;
    (Array.isArray(script.script) ? script.script : []).forEach((s) => {
      text += `[${s.timestamp}]\n🎥 画面：${s.visual}\n🎙️ 声音：${s.audio}\n\n`;
    });
    text += `【引导转化(CTA)】${script.cta}`;
    return text;
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 pb-20">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-black text-white p-1.5 rounded-lg">
              <Video className="w-5 h-5" />
            </div>
            <h1 className="font-bold text-lg tracking-tight">TK跨境带货视频</h1>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setAccountOpen((value) => !value)} className="text-xs font-medium px-2.5 py-1.5 rounded-full border flex items-center gap-1.5 bg-white text-slate-600 border-slate-200 hover:border-slate-300">
              <UserRound className="w-3.5 h-3.5" /> {account ? `${account.email} · ${account.credits} 积分` : "登录 / 注册"}
            </button>
            {window.tkDesktop && (
              <button
                type="button"
                onClick={handleDesktopUpdateAction}
                className={`text-xs font-medium px-2.5 py-1.5 rounded-full border flex items-center gap-1.5 transition ${updateStatus?.state === "available" || updateStatus?.state === "downloaded" ? "bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100" : updateStatus?.state === "error" ? "bg-rose-50 text-rose-700 border-rose-200" : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"}`}
                title={updateStatus?.message || "检查软件更新"}
              >
                {updateStatus?.state === "downloaded" ? <RotateCcw className="w-3.5 h-3.5" /> : updateStatus?.state === "downloading" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                {updateStatus?.state === "available" ? `更新 ${updateStatus.version || ""}` : updateStatus?.state === "downloading" ? `${updateStatus.percent || 0}%` : updateStatus?.state === "downloaded" ? "安装更新" : `V${desktopVersion || "1.0.0"}`}
              </button>
            )}
            {!commercialMode && <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${modelStatus?.ok ? "bg-emerald-50 text-emerald-700 border-emerald-100" : "bg-slate-100 text-slate-600 border-slate-200"}`}>
              {modelConfig.provider === "ollama" ? "Script · Local Ollama" : `Script · ${getCloudProviderPreset(modelConfig.cloudProviderId).name}` }
              {modelConfig.model ? ` · ${modelConfig.model}` : ""}
            </span>}
          </div>
        </div>
        {accountOpen && <div className="absolute right-4 top-14 w-80 rounded-xl border border-slate-200 bg-white p-4 shadow-xl z-20">
          {account ? <div className="space-y-3 text-sm"><div className="font-semibold">账户中心</div><div className="text-slate-600">当前余额：<span className="font-bold text-indigo-600">{account.credits} 积分</span></div><p className="text-xs text-slate-500">充值功能将在接入微信支付/支付宝后开放。</p><button type="button" className="text-xs text-slate-500 underline" onClick={() => { setAccount(null); setAccountToken(""); }}>退出登录</button></div> : <form onSubmit={submitAccount} className="space-y-3"><div className="flex items-center justify-between"><span className="font-semibold">{accountMode === "login" ? "登录账户" : "注册账户"}</span><button type="button" className="text-xs text-indigo-600" onClick={() => { setAccountMode(accountMode === "login" ? "register" : "login"); setAccountError(""); }}>{accountMode === "login" ? "注册新账户" : "返回登录"}</button></div><Input type="email" placeholder="邮箱" value={accountEmail} onChange={(e) => setAccountEmail(e.target.value)} required /><Input type="password" placeholder="至少 8 位密码" value={accountPassword} onChange={(e) => setAccountPassword(e.target.value)} minLength={8} required />{accountError && <p className="text-xs text-rose-600">{accountError}</p>}<Button type="submit" className="w-full" disabled={accountBusy}>{accountBusy ? "处理中…" : accountMode === "login" ? "登录" : "注册并领取 100 积分"}</Button></form>}
        </div>}
      </header>

      <main className="max-w-5xl mx-auto px-4 mt-8 grid grid-cols-1 lg:grid-cols-12 gap-8">

        {/* Input Form Column */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
            <div className="mb-6">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-indigo-500" />
                脚本需求与定制
              </h2>
              <p className="text-sm text-slate-500 mt-1">
                选择目标国家与产品细节，底层 AI 模型将为您深度定制。
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {!commercialMode && <>
              {/* AI Model Engine */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <Label className="flex items-center gap-2 font-semibold text-slate-900">
                      <Cpu className="w-4 h-4 text-slate-700" /> AI 模型引擎
                    </Label>
                    <p className="text-xs text-slate-500 mt-1">本地 Ollama 与云端 API 可随时切换</p>
                  </div>
                  {modelStatus && (
                    <span className={`text-[11px] px-2 py-1 rounded-full flex items-center gap-1 ${modelStatus.ok ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
                      {modelStatus.ok ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
                      {modelStatus.ok ? "已连接" : "未连接"}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => { setModelConfig((p) => ({ ...p, provider: "ollama", baseUrl: p.provider === "ollama" ? p.baseUrl : "http://127.0.0.1:11434", apiKey: "" })); setModelStatus(null); }} className={`h-10 rounded-lg border text-sm font-medium flex items-center justify-center gap-2 transition ${modelConfig.provider === "ollama" ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-700 border-slate-200 hover:border-slate-300"}`}>
                    <Cpu className="w-4 h-4" /> 本地 Ollama
                  </button>
                  <button type="button" onClick={() => selectCloudProvider(modelConfig.cloudProviderId || "openai")} className={`h-10 rounded-lg border text-sm font-medium flex items-center justify-center gap-2 transition ${modelConfig.provider !== "ollama" ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-700 border-slate-200 hover:border-slate-300"}`}>
                    <Cloud className="w-4 h-4" /> 云端模型库
                  </button>
                </div>

                {modelConfig.provider === "ollama" ? (
                  <>
                    <div className="space-y-1.5">
                      <Label>Ollama 地址</Label>
                      <div className="flex gap-2">
                        <Input value={modelConfig.baseUrl} onChange={(e) => setModelConfig({ ...modelConfig, baseUrl: e.target.value })} placeholder="http://127.0.0.1:11434" />
                        <button type="button" onClick={() => loadOllamaModels()} disabled={modelChecking} className="h-10 w-10 shrink-0 rounded-md border border-slate-200 bg-white hover:bg-slate-50 flex items-center justify-center disabled:opacity-50" title="刷新本地模型">
                          <RefreshCw className={`w-4 h-4 ${modelChecking ? "animate-spin" : ""}`} />
                        </button>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label>脚本生成模型</Label>
                      {ollamaModels.length ? (
                        <Select value={modelConfig.model} onChange={(e) => setModelConfig({ ...modelConfig, model: e.target.value })}>
                          {ollamaModels.map((model) => <option key={model} value={model}>{model}</option>)}
                        </Select>
                      ) : (
                        <Input value={modelConfig.model} onChange={(e) => setModelConfig({ ...modelConfig, model: e.target.value })} placeholder="例如 qwen3.5:9b" />
                      )}
                      <p className="text-[11px] text-slate-500">这个模型只负责生成 Hook、分镜、配音与 CTA；如果使用独立视觉模型，脚本模型无需支持图片。</p>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="space-y-1.5">
                      <Label>云端服务商</Label>
                      <Select
                        value={modelConfig.cloudProviderId || "openai"}
                        onChange={(e) => selectCloudProvider(e.target.value)}
                      >
                        {(["国际主流", "中国大陆", "聚合平台", "高速推理", "自定义"] as const).map((group) => (
                          <optgroup key={group} label={group}>
                            {CLOUD_PROVIDER_PRESETS.filter((p) => p.group === group).map((p) => (
                              <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                          </optgroup>
                        ))}
                      </Select>
                      <p className="text-[11px] text-slate-500 leading-relaxed">
                        {getCloudProviderPreset(modelConfig.cloudProviderId).note || "选择服务商后，可用 API Key 实时读取该账号当前开放的模型，不依赖写死列表。"}
                      </p>
                    </div>

                    <div className="space-y-1.5">
                      <Label>API Base URL</Label>
                      <Input
                        value={modelConfig.baseUrl}
                        onChange={(e) => setModelConfig({ ...modelConfig, baseUrl: e.target.value })}
                        placeholder="https://api.example.com/v1"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="flex items-center gap-1.5"><KeyRound className="w-3.5 h-3.5" /> API Key</Label>
                      <Input
                        type="password"
                        value={modelConfig.apiKey || ""}
                        onChange={(e) => setModelConfig({ ...modelConfig, apiKey: e.target.value })}
                        placeholder="只发送到你选择的服务商，不写入项目文件"
                        autoComplete="off"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <Label>脚本生成模型</Label>
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => loadCloudModels()}
                            disabled={cloudModelsLoading}
                            className="text-[11px] font-medium text-indigo-600 hover:text-indigo-700 disabled:opacity-50 flex items-center gap-1"
                          >
                            <RefreshCw className={`w-3 h-3 ${cloudModelsLoading ? "animate-spin" : ""}`} />
                            {cloudModelsLoading ? "读取中" : "读取当前模型"}
                          </button>
                          <button
                            type="button"
                            onClick={() => setUseCustomCloudModelInput((v) => !v)}
                            className="text-[11px] font-medium text-slate-600 hover:text-slate-800"
                          >
                            {useCustomCloudModelInput ? "使用下拉选择" : "手动输入模型 ID"}
                          </button>
                        </div>
                      </div>

                      {!useCustomCloudModelInput && cloudModels.length > 0 ? (
                        <Select
                          value={modelConfig.model}
                          onChange={(e) => setModelConfig({ ...modelConfig, model: e.target.value })}
                        >
                          {cloudModels.map((m) => <option key={m.id} value={m.id}>{m.name || m.id}{m.name && m.name !== m.id ? ` · ${m.id}` : ""}</option>)}
                        </Select>
                      ) : (
                        <Input
                          value={modelConfig.model}
                          onChange={(e) => setModelConfig({ ...modelConfig, model: e.target.value })}
                          placeholder={getCloudProviderPreset(modelConfig.cloudProviderId).modelHint}
                        />
                      )}

                      <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] leading-relaxed text-slate-600">
                        {cloudModels.length ? `当前目录：${cloudModels.length} 个可用模型` : "可直接手动输入模型 ID"}
                        <div className="mt-1 text-slate-500">脚本模型默认只接收文字和已经锁定的视觉事实。</div>
                      </div>
                    </div>
                  </>
                )}

                <div className="rounded-xl border border-indigo-200 bg-indigo-50/50 p-3 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <Label className="font-semibold text-slate-900">产品图片识别模型</Label>
                      <p className="text-[11px] text-slate-500 mt-1">只负责看图并提取颜色、包装、标签等视觉事实；脚本模型不再重复接收原图。</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setUseSameModelForVision((v) => {
                          const next = !v;
                          if (next) setModelConfig((p) => ({ ...p, inputMode: "multimodal" }));
                          setVisualFacts(null);
                          return next;
                        });
                      }}
                      className={`shrink-0 px-2.5 py-1.5 rounded-lg border text-[11px] font-medium ${useSameModelForVision ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-700 border-slate-200"}`}
                    >
                      {useSameModelForVision ? "✓ 与脚本同模型" : "使用独立视觉模型"}
                    </button>
                  </div>

                  {useSameModelForVision ? (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800 leading-relaxed">
                      当前由 <b>{modelConfig.model || "未选择脚本模型"}</b> 同时负责图片识别和脚本生成。请确认它确实支持图片输入；如果是 Qwen3-VL Thinking 这类模型，建议取消同模型，改用独立视觉模型。
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setVisionModelConfig((p) => ({
                              ...p,
                              provider: "ollama",
                              baseUrl: p.provider === "ollama" ? p.baseUrl : "http://127.0.0.1:11434",
                              apiKey: "",
                              inputMode: "multimodal",
                            }));
                            setVisionModelStatus(null);
                            setVisualFacts(null);
                          }}
                          className={`h-9 rounded-lg border text-xs font-medium flex items-center justify-center gap-1.5 ${visionModelConfig.provider === "ollama" ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-700 border-slate-200"}`}
                        >
                          <Cpu className="w-3.5 h-3.5" /> 本地 Ollama
                        </button>
                        <button
                          type="button"
                          onClick={() => selectVisionCloudProvider(visionModelConfig.cloudProviderId || "openai")}
                          className={`h-9 rounded-lg border text-xs font-medium flex items-center justify-center gap-1.5 ${visionModelConfig.provider !== "ollama" ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-700 border-slate-200"}`}
                        >
                          <Cloud className="w-3.5 h-3.5" /> 云端视觉模型
                        </button>
                      </div>

                      {visionModelConfig.provider === "ollama" ? (
                        <>
                          <div className="space-y-1.5">
                            <Label className="text-xs">视觉 Ollama 地址</Label>
                            <div className="flex gap-2">
                              <Input
                                value={visionModelConfig.baseUrl}
                                onChange={(e) => setVisionModelConfig({ ...visionModelConfig, baseUrl: e.target.value, inputMode: "multimodal" })}
                                placeholder="http://127.0.0.1:11434"
                              />
                              <button type="button" onClick={() => loadVisionOllamaModels()} disabled={visionModelChecking} className="h-10 w-10 shrink-0 rounded-md border border-slate-200 bg-white flex items-center justify-center disabled:opacity-50">
                                <RefreshCw className={`w-4 h-4 ${visionModelChecking ? "animate-spin" : ""}`} />
                              </button>
                            </div>
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs">图片识别模型</Label>
                            {visionOllamaModels.length ? (
                              <Select
                                value={visionModelConfig.model}
                                onChange={(e) => { setVisionModelConfig({ ...visionModelConfig, model: e.target.value, inputMode: "multimodal" }); setVisualFacts(null); }}
                              >
                                {visionOllamaModels.map((model) => {
                                  const info = visionOllamaModelInfos.find((m) => m.name === model);
                                  return <option key={model} value={model}>{model}{info?.vision ? " · VISION" : ""}{info?.dedicatedThinking ? " · THINKING" : ""}</option>;
                                })}
                              </Select>
                            ) : (
                              <Input
                                value={visionModelConfig.model}
                                onChange={(e) => setVisionModelConfig({ ...visionModelConfig, model: e.target.value, inputMode: "multimodal" })}
                                placeholder="例如 qwen3-vl:8b"
                              />
                            )}
                            <p className="text-[11px] text-slate-500">请选择实际支持图片输入的模型。Qwen3-VL Thinking 可以专门负责看图，脚本交给另一个文本模型。</p>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="space-y-1.5">
                            <Label className="text-xs">视觉模型服务商</Label>
                            <Select value={visionModelConfig.cloudProviderId || "openai"} onChange={(e) => selectVisionCloudProvider(e.target.value)}>
                              {(["国际主流", "中国大陆", "聚合平台", "高速推理", "自定义"] as const).map((group) => (
                                <optgroup key={group} label={group}>
                                  {CLOUD_PROVIDER_PRESETS.filter((p) => p.group === group).map((p) => (
                                    <option key={p.id} value={p.id}>{p.name}</option>
                                  ))}
                                </optgroup>
                              ))}
                            </Select>
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs">视觉 API Base URL</Label>
                            <Input value={visionModelConfig.baseUrl} onChange={(e) => setVisionModelConfig({ ...visionModelConfig, baseUrl: e.target.value, inputMode: "multimodal" })} />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs flex items-center gap-1.5"><KeyRound className="w-3.5 h-3.5" /> 视觉 API Key</Label>
                            <Input
                              type="password"
                              value={visionModelConfig.apiKey || ""}
                              onChange={(e) => setVisionModelConfig({ ...visionModelConfig, apiKey: e.target.value, inputMode: "multimodal" })}
                              placeholder="视觉模型对应的 API Key"
                              autoComplete="off"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between gap-2">
                              <Label className="text-xs">图片识别模型</Label>
                              <div className="flex gap-2">
                                <button type="button" onClick={() => loadVisionCloudModels()} disabled={visionCloudModelsLoading} className="text-[11px] text-indigo-600 font-medium flex items-center gap-1">
                                  <RefreshCw className={`w-3 h-3 ${visionCloudModelsLoading ? "animate-spin" : ""}`} />读取模型
                                </button>
                                <button type="button" onClick={() => setVisionUseCustomCloudModelInput((v) => !v)} className="text-[11px] text-slate-600 font-medium">
                                  {visionUseCustomCloudModelInput ? "使用下拉" : "手动输入"}
                                </button>
                              </div>
                            </div>
                            {!visionUseCustomCloudModelInput && visionCloudModels.length ? (
                              <Select
                                value={visionModelConfig.model}
                                onChange={(e) => { setVisionModelConfig({ ...visionModelConfig, model: e.target.value, inputMode: "multimodal" }); setVisualFacts(null); }}
                              >
                                {visionCloudModels.map((m) => <option key={m.id} value={m.id}>{m.name || m.id}{m.name && m.name !== m.id ? ` · ${m.id}` : ""}</option>)}
                              </Select>
                            ) : (
                              <Input
                                value={visionModelConfig.model}
                                onChange={(e) => setVisionModelConfig({ ...visionModelConfig, model: e.target.value, inputMode: "multimodal" })}
                                placeholder={getCloudProviderPreset(visionModelConfig.cloudProviderId).modelHint}
                              />
                            )}
                            <p className="text-[11px] text-slate-500">系统不会猜测能力，请只选择你确认支持图片输入的模型。</p>
                          </div>
                        </>
                      )}

                      <button type="button" onClick={testVisionModelConnection} disabled={visionModelChecking} className="w-full h-9 rounded-lg bg-white border border-indigo-200 text-xs font-medium text-slate-700 flex items-center justify-center gap-2 disabled:opacity-50">
                        {visionModelChecking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wifi className="w-3.5 h-3.5" />} 测试视觉模型连接
                      </button>
                      {visionModelStatus && <p className={`text-xs leading-relaxed ${visionModelStatus.ok ? "text-emerald-700" : "text-rose-600"}`}>{visionModelStatus.message}</p>}
                    </>
                  )}
                </div>

                <button type="button" onClick={testModelConnection} disabled={modelChecking} className="w-full h-9 rounded-lg bg-white border border-slate-200 hover:border-slate-300 text-xs font-medium text-slate-700 flex items-center justify-center gap-2 disabled:opacity-50">
                  {modelChecking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wifi className="w-3.5 h-3.5" />} 测试模型连接
                </button>
              {modelStatus && <p className={`text-xs leading-relaxed ${modelStatus.ok ? "text-emerald-700" : "text-rose-600"}`}>{modelStatus.message}</p>}
              </div>
              </>}

              {/* Target Region */}
              <div className="space-y-2">
                <Label htmlFor="region-select" className="flex items-center gap-1.5 font-semibold text-slate-800">
                  <Globe2 className="w-4 h-4 text-indigo-600" />
                  目标销售区域 / 国家市场
                </Label>
                <Select
                  id="region-select"
                  value={formData.region}
                  onChange={(e) => {
                    const newRegion = e.target.value;
                    const regionAudiences = AUDIENCE_BY_REGION[newRegion] || AUDIENCE_BY_REGION[REGION_OPTIONS[0].id];
                    const regionFeatures = FEATURES_BY_REGION[newRegion] || FEATURES_BY_REGION[REGION_OPTIONS[0].id];
                    setFormData({
                      ...formData,
                      region: newRegion,
                      targetAudience: regionAudiences[0],
                      features: regionFeatures[0],
                    });
                  }}
                >
                  {REGION_OPTIONS.map((r) => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </Select>
                <div className="text-xs text-indigo-700 bg-indigo-50/90 px-3 py-2 rounded-lg border border-indigo-100 flex items-center gap-1.5">
                  <span className="font-medium">✨ 特色：</span>
                  <span>{REGION_OPTIONS.find((r) => r.id === formData.region)?.badge}</span>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label>产品参考图 (可选，AI 将自动识别)</Label>
                  <span className={`text-[11px] px-2 py-1 rounded-full border ${selectedModelSupportsImage ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-700"}`}>
                    {selectedModelSupportsImage ? `视觉模型：${effectiveVisionModelConfig.model || "已配置"} · 可上传` : "请先配置图片识别模型"}
                  </span>
                </div>
                <div className="flex items-center justify-center w-full">
                  <label
                    htmlFor={selectedModelSupportsImage ? "dropzone-file" : undefined}
                    className={`flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg relative overflow-hidden transition-colors ${selectedModelSupportsImage ? "cursor-pointer bg-slate-50 hover:bg-slate-100 border-slate-300" : "cursor-not-allowed bg-slate-100 border-slate-200 opacity-80"}`}
                  >
                    {formData.image ? (
                      <>
                        <img src={formData.image} alt="Preview" className="absolute inset-0 w-full h-full object-contain bg-slate-100" />
                        <button
                          type="button"
                          onClick={(e) => { e.preventDefault(); setVisualFacts(null); setFormData({ ...formData, image: undefined, visualFacts: undefined }); }}
                          className="absolute top-2 right-2 bg-slate-900/60 text-white p-1.5 rounded-full hover:bg-slate-900 transition-colors z-10"
                        >
                          <X className="w-4 h-4" />
                        </button>
                        {!selectedModelSupportsImage && (
                          <div className="absolute inset-x-0 bottom-0 bg-amber-600/90 text-white text-[11px] px-3 py-2 text-center">
                            当前没有可用的图片识别模型，请先在上方配置视觉模型。
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="flex flex-col items-center justify-center pt-5 pb-6 px-4 text-center">
                        <Upload className={`w-6 h-6 mb-2 ${selectedModelSupportsImage ? "text-slate-400" : "text-slate-300"}`} />
                        {selectedModelSupportsImage ? (
                          <>
                            <p className="mb-1 text-sm text-slate-500"><span className="font-semibold text-indigo-600">点击上传</span> 或拖拽图片</p>
                            <p className="text-xs text-slate-500">支持 PNG, JPG, WEBP (最大 5MB)</p>
                          </>
                        ) : (
                          <>
                            <p className="mb-1 text-sm font-medium text-slate-600">尚未配置图片识别模型</p>
                            <p className="text-xs text-slate-500">请先在 AI 模型引擎中选择一个支持图片的视觉模型。</p>
                          </>
                        )}
                      </div>
                    )}
                    <input id="dropzone-file" type="file" className="hidden" accept="image/*" onChange={handleImageChange} disabled={!selectedModelSupportsImage} />
                  </label>
                </div>
              </div>

              {visualFacts && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3 text-xs text-slate-700 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-emerald-800 flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4" /> 图片视觉事实已锁定</span>
                    <span className="text-[10px] text-emerald-700">脚本必须服从这些事实</span>
                  </div>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
                    <div><span className="text-slate-500">产品类型：</span>{visualFacts.productType || "未确认"}</div>
                    <div><span className="text-slate-500">包装：</span>{visualFacts.packageType || "未确认"}</div>
                    <div><span className="text-slate-500">主体颜色：</span><span className="font-semibold">{visualFacts.primaryColor || "未确认"}</span></div>
                    <div><span className="text-slate-500">材质：</span>{visualFacts.material || "未确认"}</div>
                  </div>
                  {visualFacts.secondaryColors?.length > 0 && <div><span className="text-slate-500">其它颜色：</span>{visualFacts.secondaryColors.join("、")}</div>}
                  {visualFacts.visibleFeatures?.length > 0 && <div><span className="text-slate-500">可见特征：</span>{visualFacts.visibleFeatures.join("；")}</div>}
                  {visualFacts.visibleText?.length > 0 && <div><span className="text-slate-500">可辨认文字：</span>{visualFacts.visibleText.join("、")}</div>}
                  {visualFacts.uncertain?.length > 0 && <div className="text-amber-700"><span className="font-medium">未确认：</span>{visualFacts.uncertain.join("；")}</div>}
                </div>
              )}

              <div className="space-y-3 p-4 bg-slate-50 border border-slate-200 rounded-lg">
                <div className="space-y-2">
                  <Label>产品分类 (大类)</Label>
                  <Select
                    value={mainCategory}
                    onChange={(e) => {
                      const newMain = e.target.value;
                      setMainCategory(newMain);
                      const newSub = Object.keys(PRODUCT_CATEGORIES[newMain])[0];
                      setSubCategory(newSub);
                      setIsCustomProduct(false);
                      setFormData({ ...formData, product: PRODUCT_CATEGORIES[newMain][newSub][0] });
                    }}
                  >
                    {Object.keys(PRODUCT_CATEGORIES).map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>细分品类 (小类)</Label>
                  <Select
                    value={subCategory}
                    onChange={(e) => {
                      const newSub = e.target.value;
                      setSubCategory(newSub);
                      setIsCustomProduct(false);
                      setFormData({ ...formData, product: PRODUCT_CATEGORIES[mainCategory][newSub][0] });
                    }}
                  >
                    {Object.keys(PRODUCT_CATEGORIES[mainCategory]).map((sub) => (
                      <option key={sub} value={sub}>{sub}</option>
                    ))}
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="product-select">具体产品</Label>
                  <Select
                    id="product-select"
                    value={isCustomProduct ? "CUSTOM" : formData.product}
                    onChange={(e) => {
                      if (e.target.value === "CUSTOM") {
                        setIsCustomProduct(true);
                        setFormData({ ...formData, product: "" });
                      } else {
                        setIsCustomProduct(false);
                        setFormData({ ...formData, product: e.target.value });
                      }
                    }}
                  >
                    {PRODUCT_CATEGORIES[mainCategory][subCategory].map((prod) => (
                      <option key={prod} value={prod}>{prod}</option>
                    ))}
                    <option value="CUSTOM" className="font-bold text-indigo-600">➕ 找不到？点此自定义输入 (Custom)</option>
                  </Select>
                </div>

                {isCustomProduct && (
                  <div className="space-y-2 mt-2">
                    <Label htmlFor="custom-product" className="text-indigo-600">输入您的自定义产品名称</Label>
                    <Input
                      id="custom-product"
                      value={formData.product}
                      onChange={(e) => setFormData({ ...formData, product: e.target.value })}
                      required
                      autoFocus
                      className="border-indigo-300 focus-visible:ring-indigo-500"
                      placeholder="例如：发光机械键盘..."
                    />
                  </div>
                )}
              </div>

                            <div className="space-y-2">
                <Label htmlFor="duration">脚本目标时长</Label>
                <Select
                  id="duration"
                  value={formData.duration}
                  onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                  required
                >
                  {DURATION_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="audience">目标受众 ({formData.region.split(' ')[0]}客群画像)</Label>
                <Select
                  id="audience"
                  value={formData.targetAudience}
                  onChange={(e) => setFormData({ ...formData, targetAudience: e.target.value })}
                  required
                >
                  {(AUDIENCE_BY_REGION[formData.region] || AUDIENCE_BY_REGION[REGION_OPTIONS[0].id]).map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="features">核心卖点 / 当地优惠与痛点策略</Label>
                <Select
                  id="features"
                  value={formData.features}
                  onChange={(e) => setFormData({ ...formData, features: e.target.value })}
                  required
                >
                  {(FEATURES_BY_REGION[formData.region] || FEATURES_BY_REGION[REGION_OPTIONS[0].id]).map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </Select>
              </div>

              <Button
                type="submit"
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    AI 模型正在深度生成中...
                  </>
                ) : (
                  '智能生成 3 款剧本'
                )}
              </Button>
            </form>
          </div>
        </div>

        {/* Results Column */}
        <div className="lg:col-span-8 space-y-6">
          {!loading && scripts.length === 0 && (
            <div className="h-full min-h-[400px] border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center text-center p-8 bg-white/50">
              <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                <Video className="w-8 h-8 text-slate-400" />
              </div>
              <h3 className="font-semibold text-lg text-slate-900">等待智能生成</h3>
              <p className="text-slate-500 text-sm max-w-sm mt-2">
                在左侧选择目标区域与产品信息，底层智能 AI 模型将深度结合【{formData.region}】的语言配音、生活习俗与爆款网感，为您量身定制高转化分镜脚本。
              </p>
            </div>
          )}

          {loading && (
            <div className="h-full min-h-[400px] rounded-2xl flex flex-col items-center justify-center text-center p-8 bg-white border border-slate-200">
              <Loader2 className="w-8 h-8 text-indigo-500 animate-spin mb-4" />
              <p className="text-slate-800 font-semibold">
                {generationStep === -1
                  ? "正在识别产品图片并锁定视觉事实..."
                  : (modelConfig.provider === "ollama" && generationStep ? `正在生成方案 ${generationStep} / 3` : "AI 正在生成 3 套脚本...")}
              </p>
              <p className="text-slate-500 text-sm mt-2">
                {generationStep === -1
                  ? `视觉模型：${effectiveVisionModelConfig.model || "未选择"}`
                  : `脚本模型：${modelConfig.model}`} · 已等待 {elapsedSeconds}s
              </p>
              <p className="text-slate-400 text-xs mt-3 max-w-md">
                {generationStep === -1
                  ? "视觉模型只负责读取图片中的颜色、包装、材质和标签事实；识别完成后，原始图片不会再发给脚本模型。"
                  : "脚本模型只接收产品文字信息和已经锁定的视觉事实，因此可以使用纯文本 Instruct 模型稳定生成脚本。"}
              </p>
            </div>
          )}

          {!loading && generationError && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5">
              <div className="flex items-start gap-3">
                <WifiOff className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-rose-900">生成失败</h3>
                  <p className="text-sm text-rose-700 mt-1 whitespace-pre-wrap">{generationError}</p>
                  <p className="text-xs text-rose-600/80 mt-2">你的产品参数不会被清空，可以直接调整模型或时长后重新生成。</p>
                </div>
              </div>
            </div>
          )}

          {Array.isArray(scripts) && scripts.map((script, index) => (
            <div key={index} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              {/* Card Header */}
              <div className="bg-slate-900 px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="bg-indigo-500/20 text-indigo-300 text-xs font-semibold px-2 py-0.5 rounded uppercase tracking-wider">
                      方案 {index + 1}
                    </span>
                    <span className="bg-slate-800 text-slate-300 text-xs px-2 py-0.5 rounded border border-slate-700">
                      {formData.region.split(' ')[0]}
                    </span>
                    <span className="text-slate-400 text-xs flex items-center gap-1">
                      <Play className="w-3 h-3" /> {script.style}
                    </span>
                  </div>
                  <h3 className="text-white font-bold text-lg leading-tight">{script.title}</h3>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyToClipboard(formatScriptForClipboard(script), index)}
                  className="shrink-0 bg-white/10 border-white/20 text-white hover:bg-white/20 border"
                >
                  {copiedIndex === index ? (
                    <><CheckCircle2 className="w-4 h-4 mr-2" /> 已复制</>
                  ) : (
                    <><Copy className="w-4 h-4 mr-2" /> 一键复制脚本</>
                  )}
                </Button>
              </div>

              {/* Hook Section */}
              <div className="p-6 border-b border-slate-100 bg-amber-50/50">
                <div className="flex items-start gap-3">
                  <div className="bg-amber-100 p-2 rounded-lg shrink-0 mt-0.5">
                    <Sparkles className="w-5 h-5 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-amber-800 uppercase tracking-wider mb-1">黄金前3秒 (爆款钩子)</p>
                    <p className="text-slate-900 font-medium leading-relaxed">{script.hook}</p>
                  </div>
                </div>
              </div>

              {/* Script Body */}
              <div className="p-6">
                <div className="space-y-6">
                  {Array.isArray(script.script) && script.script.map((scene, i) => (
                    <div key={i} className="flex gap-4 relative">
                      <div className="w-16 shrink-0 pt-1 text-right">
                        <span className="text-xs font-bold text-slate-400 tabular-nums">{scene.timestamp}</span>
                      </div>

                      {/* Timeline line */}
                      <div className="absolute left-[72px] top-2 bottom-[-24px] w-px bg-slate-200 last:hidden" />
                      <div className="absolute left-[69px] top-1.5 w-2 h-2 rounded-full bg-slate-300" />

                      <div className="flex-1 space-y-3 pb-2">
                        <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 flex gap-3">
                          <Video className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                          <p className="text-sm text-slate-600">画面：{scene.visual}</p>
                        </div>
                        <div className="flex gap-3 px-3">
                          <Type className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                          <p className="text-sm text-slate-900 font-medium whitespace-pre-wrap">配音：{scene.audio}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* CTA Section */}
              <div className="bg-slate-50 px-6 py-4 border-t border-slate-100 flex items-start gap-3">
                 <div className="bg-indigo-100 p-2 rounded-lg shrink-0 mt-0.5">
                    <Play className="w-4 h-4 text-indigo-600" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-indigo-800 uppercase tracking-wider mb-1">行动号召 (CTA)</p>
                    <p className="text-slate-900 font-medium">{script.cta}</p>
                  </div>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
