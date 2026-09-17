// 数据从参考实现 TK跨境视频脚本生成器/src/App.tsx 提取（真实业务数据）
// eslint-disable-next-line
export const REGION_OPTIONS = [
  {
    id: "美区 (United States)",
    name: "美区 (United States)",
    badge: "美式英语 · 快剪痛点反差 · TikTok热梗"
  },
  {
    id: "日区 (Japan)",
    name: "日区 (Japan / 日本)",
    badge: "地道日语 · 隐私与收纳清洁 · QOL精致感"
  },
  {
    id: "泰区 (Thailand)",
    name: "泰区 (Thailand / 泰国)",
    badge: "地道泰语 · 泰式幽默反转 · 防水防汗与COD货到付款"
  },
  {
    id: "马来西亚区 (Malaysia)",
    name: "马来西亚区 (Malaysia)",
    badge: "马来语/Manglish · 多元文化包容 · 包邮与折扣券"
  },
  {
    id: "印尼区 (Indonesia)",
    name: "印尼区 (Indonesia / 印尼)",
    badge: "印尼语爆款口癖 · 年轻庞大人口 · 极致性价比与COD"
  }
];

export const AUDIENCE_BY_REGION: Record<string, string[]> = {
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

export const FEATURES_BY_REGION: Record<string, string[]> = {
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

export const PRODUCT_CATEGORIES: Record<string, Record<string, string[]>> = {
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

export const DURATION_OPTIONS = [
  "10秒 · ¥0.20 (极限短平快/极速促单)",
  "15秒 · ¥0.30 (极速引流/强视觉)",
  "20-30秒 · ¥0.60 (标准爆款展示)",
  "45秒 · ¥0.90 (深度痛点解析)",
  "60秒 · ¥1.20 (完整沉浸式评测)"
];
