/* ==========================================================================
   BASE DE DATOS SIMULADA (data.js)
   Almacena Especialistas, Farmacia y gestiona el LocalStorage
   ========================================================================== */

const datosIniciales = {
    // 1. CARTERA DE ESPECIALISTAS Y PERSONAL MÉDICO
    cartera_especialistas: [
        {
            id: "esp-001",
            especialidad: "MEDICINA FAMILIAR",
            duracion_minutos: 40,
            horarios_atencion: { dias: [1, 2, 3, 4, 5, 6], hora_inicio: "07:00", hora_fin: "17:00", hora_fin_sabado: "13:00" },
            doctor: {
                nombres: "Verónica Del Pilar",
                apellidos: "Barahona Charfuelan",
                nombre_completo: "Dra. Verónica Del Pilar Barahona Charfuelan",
                cedula: "1715811293"
            },
            actividades: [
                "Consulta medica", "Suturas", "Curación de Heridas",
                "Terapia Individual", "Terapia Familiar", "Terapia Grupal",
                "Cuidados Prenatales", "Medicina Preventiva", "Visitas Domiciliarias"
            ]
        },
        {
            id: "esp-002",
            especialidad: "MEDICINA GENERAL",
            duracion_minutos: 35,
            horarios_atencion: { dias: [1, 2, 3, 4, 5, 6], hora_inicio: "07:00", hora_fin: "17:00", hora_fin_sabado: "13:00" },
            doctor: {
                nombres: "Oscar Bladimir",
                apellidos: "Poma Sumba",
                nombre_completo: "Dr. Oscar Bladimir Poma Sumba",
                cedula: "1714967625"
            },
            actividades: [
                "Prevención de enfermedades", "Diagnóstico de enfermedades",
                "Tratamiento de enfermedades", "Derivación a especialidades",
                "Suturas", "Curación de Heridas", "Medicina Preventiva"
            ]
        },
        {
            id: "esp-003",
            especialidad: "RADIODIÁGNOSTICO",
            duracion_minutos: 35,
            horarios_atencion: { dias: [1, 2, 3, 4, 5, 6], hora_inicio: "10:00", hora_fin: "12:00" },
            doctor: {
                nombres: "Camilo Calixto",
                apellidos: "Sifontes Zayas",
                nombre_completo: "Dr. Camilo Calixto Sifontes Zayas",
                cedula: "1754664082"
            },
            actividades: [
                "Realización de Ecografías Abdominales", "Realización de Ecografías Ginecológicas",
                "Realización de Ecografías Prostática", "Realización de Ecografías Obstétricas",
                "Realización de Ecografías Articulares", "Realización de Ecografías Doppler",
                "Interpretación de Ecografías", "Diagnóstico de Ecografías"
            ]
        },
        {
            id: "esp-004",
            especialidad: "DERMATOLOGÍA",
            duracion_minutos: 30,
            horarios_atencion: { dias: [3], hora_inicio: "14:00", hora_fin: "16:00" }, // Miércoles
            doctor: {
                nombres: "María Del Carmen",
                apellidos: "Terán Pineida",
                nombre_completo: "Dra. María Del Carmen Terán Pineida",
                cedula: "1715922652"
            },
            actividades: [
                "Consulta Medica", "Diagnóstico de Enfermedades Dermatológicos",
                "Tratamiento de Enfermedades Dermatológicos", "Prevención de Enfermedades Dermatológicos"
            ]
        },
        {
            id: "esp-005",
            especialidad: "UROLOGÍA",
            duracion_minutos: 30,
            horarios_atencion: { dias: [2], hora_inicio: "14:00", hora_fin: "16:00" }, // Martes
            doctor: {
                nombres: "Mario Lenin",
                apellidos: "Moran Molina",
                nombre_completo: "Dr. Mario Lenin Moran Molina",
                cedula: "703914671"
            },
            actividades: [
                "Consulta Medica", "Diagnóstico de Enfermedades Urología",
                "Tratamiento de Enfermedades Urología", "Prevención de Enfermedades Urológicas"
            ]
        },
        {
            id: "esp-006",
            especialidad: "ENDOCRINOLOGÍA",
            duracion_minutos: 20,
            horarios_atencion: { dias: [6], hora_inicio: "08:00", hora_fin: "11:00" }, // Sábados
            doctor: {
                nombres: "José Fernando",
                apellidos: "Guerrero Grijalva",
                nombre_completo: "Dr. José Fernando Guerrero Grijalva",
                cedula: "1803004140"
            },
            actividades: [
                "Consulta Medica", "Diagnóstico de Enfermedades Endocrinología",
                "Tratamiento de Enfermedades Endocrinología", "Prevención de Enfermedades Endocrinológicas",
                "Manejo de problemas nutricionales", "Soporte Nutricional"
            ]
        },
        {
            id: "esp-007",
            especialidad: "TRAUMATOLOGÍA",
            duracion_minutos: 60,
            horarios_atencion: { dias: [4], hora_inicio: "09:00", hora_fin: "11:00" }, // Jueves
            doctor: {
                nombres: "Deulis Rafael",
                apellidos: "Salazar Coello",
                nombre_completo: "Dr. Deulis Rafael Salazar Coello",
                cedula: "132863513"
            },
            actividades: [
                "Consulta Medica", "Diagnóstico de Enfermedades de Traumatología",
                "Tratamiento de Enfermedades de Traumatología", "Prevención de Enfermedades de Traumatología",
                "Infiltración de plasma rico en plaquetas", "Infiltración de Ácido Hialurónico",
                "Infiltración de esteroides intra y extra articulares para lesiones musculo esquelético"
            ]
        },
        {
            id: "esp-008",
            especialidad: "PSICOLOGÍA",
            duracion_minutos: 60,
            horarios_atencion: { dias: [6], hora_inicio: "08:00", hora_fin: "12:00" }, // Sábados
            doctor: {
                nombres: "Katalina Sofía",
                apellidos: "Rivadeneira Vasconez",
                nombre_completo: "Psic. Katalina Sofía Rivadeneira Vasconez",
                cedula: "1804503140"
            },
            actividades: [
                "Terapia psicológica", "Identificación de problemas", "Restructuración de pensamientos",
                "Evaluación de personalidad", "Informe psicológico", "Psicoterapia",
                "Terapia de pareja", "Terapia individual", "Terapia familiar", "Test Vocacional"
            ]
        },
        {
            id: "esp-009",
            especialidad: "ODONTOLOGÍA",
            duracion_minutos: 35,
            horarios_atencion: { dias: [1, 2, 3, 4, 5, 6], hora_inicio: "07:00", hora_fin: "17:00", hora_fin_sabado: "13:00" },
            doctor: {
                nombres: "Tania Maribel",
                apellidos: "Lara Vega",
                nombre_completo: "Odont. Tania Maribel Lara Vega",
                cedula: "1721932133"
            },
            actividades: [
                "Odontología Preventiva", "Operatoria Dental", "Extracciones Simples"
            ]
        },
        {
            id: "esp-010",
            especialidad: "ENFERMERÍA",
            duracion_minutos: 15,
            horarios_atencion: { dias: [1, 2, 3, 4, 5, 6], hora_inicio: "07:00", hora_fin: "17:00", hora_fin_sabado: "13:00" },
            doctor: {
                nombres: "Milton Fernando",
                apellidos: "Rosero Mendoza",
                nombre_completo: "Lic. Milton Fernando Rosero Mendoza",
                cedula: "1712509031"
            },
            actividades: [
                "Toma de signos vitales", "Promoción de salud",
                "Educación Sanitaria", "Colaboración Multidisciplinaria"
            ]
        },
        {
            id: "esp-011",
            especialidad: "LABORATORIO",
            duracion_minutos: 12,
            horarios_atencion: { dias: [1, 2, 3, 4, 5, 6], hora_inicio: "07:00", hora_fin: "17:00", hora_fin_sabado: "13:00" },
            doctor: {
                nombres: "Yolanda Antonela",
                apellidos: "Sánchez Barahona",
                nombre_completo: "Lic. Yolanda Antonela Sánchez Barahona",
                cedula: "1722167457"
            },
            actividades: [
                "Análisis Clínicos: Hemostasia y Coagulación", "Química Sanguínea",
                "Serología", "Uroanálisis", "Coproanálisis", "Toxicología",
                "Inmunología", "Hematología"
            ]
        },
        {
            id: "esp-012",
            especialidad: "GINECOLOGÍA",
            duracion_minutos: 40,
            horarios_atencion: { dias: [6], hora_inicio: "08:00", hora_fin: "12:00" }, // Sábados
            doctor: {
                nombres: "Marco Daniel",
                apellidos: "Moya Carrillo",
                nombre_completo: "Dr. Marco Daniel Moya Carrillo",
                cedula: "1711841880"
            },
            actividades: [
                "Consulta Medica", "Diagnóstico de Enfermedades Ginecológicas",
                "Tratamiento de Enfermedades Ginecológicas", "Prevención de Enfermedades Ginecológicas",
                "Asesoramiento y planificación familiar", "Manejo de ETS",
                "Interpretación y manejo de resultados de citología", "Manejo de embarazos"
            ]
        },
        {
            id: "esp-013",
            especialidad: "GINECOLOGÍA",
            duracion_minutos: 40,
            horarios_atencion: { dias: [6], hora_inicio: "08:00", hora_fin: "12:00" }, // Sábados
            doctor: {
                nombres: "Marcela Paulina",
                apellidos: "Pantoja Vargas",
                nombre_completo: "Dra. Marcela Paulina Pantoja Vargas",
                cedula: "1707951602"
            },
            actividades: [
                "Consulta Medica", "Diagnóstico de Enfermedades Ginecológicas",
                "Tratamiento de Enfermedades Ginecológicas", "Prevención de Enfermedades Ginecológicas",
                "Asesoramiento y planificación familiar", "Manejo de ETS",
                "Interpretación y manejo de resultados de citología", "Manejo de embarazos"
            ]
        }
    ],

    // 2. INVENTARIO DE FARMACIA (Botiquín)
    inventario_botiquin: {
        categorias_medicamentos: [
            {
                "inventario_botiquin": {
                    "categorias_medicamentos": [
                        {
                            "categoria": "ANTIPIRETICOS – ANTIINFLAMATORIOS PEDIATRICOS",
                            "productos": [
                                "APYRAL GOTAS (PARACETAMOL 100MG/ML) GOTERO #1 (UNO)",
                                "APYRAL (PARACETAMOL 160MG/5ML) JARABE #1 120ML (UNO)",
                                "APYRAL (PARACETAMOL 160MG/5ML) JARABE #1 200ML(UNO)",
                                "FINALIN NIÑOS (PARACETAMOL 160MG) PASTILLAS #12 (DOCE)",
                                "NAPAFEN (PARACETAMOL 125MG) SUPOSITORIOS #5 (CINCO)",
                                "NAPAFEN (PARACETAMOL 300MG) SUPOSITORIOS #5 (CINCO)",
                                "DOLORGESIC (IBUPROFENO 40MG/ML) GOTERO #1 (UNO)",
                                "DOLORGESIC FORTE (IBUPROFENO 200MG/5ML) JARABE #1 (UNO)",
                                "BUPREX FORTE (IBUPROFENO 200MG/5ML) JARABE #1 (UNO)",
                                "NOVALGINA (METAMIZOL 250 MG/ 5ML) JARABE #1 (UNO)"
                            ]
                        },
                        {
                            "categoria": "ANTIPIRETICOS - ANTIINFLAMATORIOS ADULTOS",
                            "productos": [
                                "ELBRUS (PARACETAMOL 1GR) SOBRES #6 (SEIS)",
                                "APYRAL RAPID (PARACETAMOL 1GR) SOBRES #6 (SEIS)",
                                "ELBRUS (PARACETAMOL) 500MG SACHETS DIEZ (10)",
                                "DOLORGESIC (IBUPROFENO 400MG) CAPSULAS #12 (DOCE)",
                                "DEXKEVITAE (DEXKETORPOFENO 25MG/10ML) SACHETS #6 (SEIS)",
                                "DOLORGESIC (IBUPROFENO 600MG) CAPSULAS#8 (OCHO)",
                                "ESPIDIFEN (IBUPROFENO 600MG) SOBRES#8 (OCHO)",
                                "DUOPAS (IBUPROFENO 400MG + HIOSCINA 20MG) CAPSULAS #10 (DIEZ)",
                                "ALTROM (KETOROLACO SUBLINGUAL 30MG) COMPRIMIDOS #5 (CINCO)",
                                "ALTROM (KETOROLACO SUBLINGUAL 20MG) COMPRIMIDOS #5 (CINCO)",
                                "KETOFLASH (KETOROLACO SUBLINGUAL 30MG) COMPRIMIDOS #5 (CINCO)",
                                "MIOLOXEN (MELOXICAM 15MG/2GR) SOBRES #5 (CINCO)",
                                "BERIFEN (DICLOFENACO 100MG) TABLETAS#5 (CINCO)",
                                "DESIFLAM RETARD (DICLOFENACO 100MG) TABLETAS#5 (CINCO)",
                                "DESIFLAM GEL (DICLOFENACO 1%) GEL 30GR #1 (UNO)",
                                "PIROXICAM 0,5% GEL 40GR #1 (UNO)",
                                "BERIFEN (DICLOFENACO)140MG PARCHE UNO (01)",
                                "DESIFLAM ICE GEL (DICLOFENACO ) GEL SACHET #5 (CINCO)",
                                "ETORICOXIB 120MG TABLETA #5 (CINCO)",
                                "DAVINTEX (ETEROCOXIB 90MG) TABLETA #5 (CINCO)",
                                "TENSIFLEX (PARACETAMOL 300 MG + CLORZOXAZONA 250 MG) COMPRIMIDOS #10 (DIEZ)",
                                "MIGRADORIXINA (CLONIXINATO DE LISINA 125MG + ERGOTAMINA 1MG) COMPRIMIDOS #10 (DIEZ)",
                                "DORIXINA RELAX (CLONIXINATO DE LISINA 125MG + CICLOBENZAPRINA 5MG) COMPRIMIDOS #10 (DIEZ)TENSI",
                                "BUPREX MIGRA (IBUPROFENO 400MG + CAFEINA 100MG + ERGOTAMINA 1MG) COMPRIMIDOS #10 (DIEZ)"
                            ]
                        },
                        {
                            "categoria": "MUCOLITICOS - ANTIHISTAMINICOS - EXPECTORANTES PEDIATRICOS",
                            "productos": [
                                "ABRILAR (HEDERA HELIX 0.7GR) JARABE #1 (UNO) 2",
                                "KALOBA (EXTRACTO DE RAÍCES DE PELARGONIUMSIDOIDES 0.8MG) GOTERO #1 (UNO)",
                                "FLUIDINE (ACETILCISTEINA 200MG) SOBRES #6 (SEIS)",
                                "SILMUCIL (ACETILCISTEINA 200MG) SOBRES #6 (SEIS)",
                                "FLUIMUCIL (ACETILCISTEINA 100MG) SOBRES #6 (SEIS)",
                                "DISOLFLEM (ACETILCISTEINA) 100MG SOBRES SEIS (06)",
                                "DISOLFLEM (ACETILCISTEINA) 200MG SOBRES SEIS (06)",
                                "MUCOXIN (AMBROXOL 15MG/5ML) JARABE #1 (UNO)",
                                "MUCOXIN (AMBROXOL 7.5MG/1ML) GOTERO #1 (UNO)",
                                "FLUIDASA (Mepifilina) 20 mg/ml GOTERO UNO (01)",
                                "BEMIN FLUX (SALBUTAMOL 2MG + CLORHIDRATO DE AMBROXOL 7.5MG/5ML) JARABE #1 (UNO)",
                                "NEBULASMA PLUS (SALBUTAMOL 2MG + CLORHIDRATO DE AMBROXOL 7.5MG/5ML) JARABE #1 (UNO)",
                                "TUSSOLVINA (DEXTROMETORFAN 15MG + GUAIFENESINA 100MG) JARABE #1 (UNO)",
                                "DEXTRIN G (DEXTROMETORFANO BROMHIDRATO 15 MG + GUAIFENESINA 100MG) JARABE 1",
                                "PROTECXIN (PARACETAMOL 160MG + DEXTROMETORFANO 7.5MG + CLORFENIRAMINA 1MG) JARABE #1 (UNO)",
                                "ALERCET ((CETIRIZINA 10/ML) GOTERO 30 GOTAS/1ML #1 (UNO)",
                                "CETRINE (CETIRIZINA 5MG/5ML) JARABE #1 (UNO)",
                                "RESPIREX (LORATADINA 5MG + BETAMETASONA 0.25MG/5ML) JARABE 60ML #1 (UNO)",
                                "MOMATE(FUROATO DE MOMETASONA 50MCG/DOSIS) SPRAY 120 DOSIS #1 (UNO)",
                                "SUERO FISIOLOGICO SOLUCION SPRAY NASAL #1 (UNO)",
                                "SOLUCION FISIOLOGICA GOTERO NASAL #1 (UNO)",
                                "AFRIN (CLORHIDRATO DE OXIMETAZOLINA 0.5%) SOLUCION NASAL #1 (UNO)"
                            ]
                        },
                        {
                            "categoria": "ANTIHISTAMINICOS - MUCOLITICOS - ANTIGRIPALES ADULTOS",
                            "productos": [
                                "ABRILAR (HEDERA DE HELIX 65MG) COMPRIMIDOS EFERVESCENTES #10 (DIEZ)",
                                "TUSSOLVINA FIT (DEXTROMETORFAN 15MG + CLORFENAMINA 4MG + GUAIFENESINA 100MG) JARABE#1 (UNO)",
                                "TUSSOLVINA FORTE (DEXTROMETORFAN 15MG + GUAIFENESINA 100MG + CLORFENIRAMINA 4MG) JARABE #1 (UNO)",
                                "PROTECXIN (PARACETAMOL 650MG + DEXTROMETORFANO 20MG + CLORFENIRAMINA 4MG) SOBRES #5 (CINCO)",
                                "BRONCOFLUX (ACETILCISTEINA) 600MG SOBRES CINCO (05)",
                                "DISOLFLEM (ACETILCISTEINA) 600MG SOBRES CINCO (05)",
                                "SILMUCIL (ACETILCISTEINA) 600MG SOBRES CINCO (05) 4",
                                "UMBRAMIL GRIP (PARACETAMOL 500MG + DEXTROMETORFANO BROMHIDRATO 15 MG+ FENILEFRINA CLORHIDRATO 5MG+ CLORFENIRAMINA MALEATO 2 MG) TABLETAS #12 (DOCE)",
                                "LEVOCET (LEVOCETIRIZINA 5MG) CÀPSULAS #10 (DIEZ)",
                                "RINOCET (LEVOCETIRIZINA 5MG) CÀPSULAS #10 (DIEZ)",
                                "RESPIREX (LORATADINA 5,0MG + BETAMETASONA 0.25MG) TABLETAS DIEZ (10)",
                                "NASTIZOL (PSEUDOEFEDRINA 600MG + CLORFENAMINA 4MG) TABLETAS #12 (DOCE)",
                                "ISLA MINT (EXTRACTO DE CETRARIA 100MG + MENTA VERDE) TABLETAS #10 (DIEZ)",
                                "HIDROXINA (HIDROXICINA 25MG) TABLETAS #10 (DIEZ)"
                            ]
                        },
                        {
                            "categoria": "ANTIBIOTICOS PEDIATRICOS",
                            "productos": [
                                "ACICLOVIR (ACICLOVIR 200MG/5ML) JARABE #1 (UNO)",
                                "AZITROMICINA 200MG/5ML SUSPENSION 15ML #1 (UNO)",
                                "BINOZYT (AZITROMICINA 200MG/5ML) JARABE #1 30ML (UNO)",
                                "CURAM 156 (AMOXICILINA 125MG + ACIDO CLAVULANICO 31.25MG/5ML) SUSPENSION#1 (UNO)",
                                "CURAM 457 (AMOXICILINA 400MG + ACIDO CLAVULANICO 57MG/5ML) SUSPENSION#1 (UNO)",
                                "CEFUZIME (CEFUROXIMA 250/5ML) SUSPENSION #1 (UNO)",
                                "CEFUR (CEFUROXIMA 250/5ML) SUSPENSION #1 (UNO)",
                                "CEFUR (CEFUROXIMA 125/5ML)70 ML SUSPENSION #1 (UNO)",
                                "MEPRIMFORTE (TRIMETOPRIMA 80MG + SULFAMETOXAZOL 400MG/5ML) JARABE #1 (UNO) 2",
                                "CLARITROMICINA 250/5ML SUSPENSION UNO #1 (UNO)",
                                "CLANIL (CLARITROMICINA 125/5ML) SUSPENSION #1 (UNO)"
                            ]
                        },
                        {
                            "categoria": "ANTIBIOTICOS ADULTOS",
                            "productos": [
                                "ACICLOVIR 800MG TABLETAS #30 (TREINTA)",
                                "CEFADROXILO 500MG TABLETAS #14 (CATORCE)",
                                "BACLOCEL (AZITROMICINA 500MG) TABLETAS # 3 (TRES)",
                                "AMOXICILINA (500MG) TABLETAS #21 (VEINTE Y UNO)",
                                "CURAM 1000MG (AMOXICILINA 875MG + ACIDO CLAVULANICO 125MG) TABLETAS #14 (CATORCE)",
                                "ALTACEF (CEFUROXIMA 500MG) TABLETAS #14 (CATORCE)",
                                "ZAMUR (CEFUROXIMA 500MG) TABLETAS #14 (CATORCE)",
                                "CEFUR (CEFUROXIMA 500MG) TABLETAS #14 (CATORCE)",
                                "UVAMIN RETARD (NITROFURANTOINA 100MG) TABLETAS #20 (VEINTE)",
                                "MONUROL (FOSFOMICINA TROMETANOL 3GR) SOBRE #1 (UNO)",
                                "CLARITROMICINA(CLARITROMICINA 500MG) TABLETAS #10 (DIEZ)",
                                "CLINDAMICINA (CLINDAMICINA 300MG) CAPSULAS #30 (TREINTA)",
                                "DICLOXACILINA 500MG TABLETAS #20 (VEINTE)",
                                "LEFLOX(LEVOFLOXACINA 500MG) TABLETAS #10 (DIEZ) 6",
                                "ETRON (METRONIDAZOL 500MG )TABLETAS #15(QUINCE)"
                            ]
                        },
                        {
                            "categoria": "ANTIPARASITARIOS PEDIATRICOS",
                            "productos": [
                                "TAZONID(NITAZOXANIDA 100MG/5ML) SUSPENSION #1 (UNO)",
                                "PARASI-KIT PEDIATRICO(ALBENDAZOL 400MG + SECNIDAZOL 500MG) CAJA #1 (UNA)"
                            ]
                        },
                        {
                            "categoria": "ANTIPARASITARIOS ADULTOS",
                            "productos": [
                                "TAZONID (NITAZOXANIDA 500MG) TABLETAS #6 (SEIS)",
                                "PARASIKIT ADULTO (ALBENDAZOL 400MG + SECNIDAZOL 2GR) CAJA #1 (UNA)"
                            ]
                        },
                        {
                            "categoria": "TRACTO DIGESTIVO",
                            "productos": [
                                "HYDRITY (SALES DE REHIDRATACION ORAL)500ML FRASCO #1 (UNO)",
                                "HYDRITY (SALES DE REHIDRATACION ORAL) 250ML FRASCO #1 (UNO)",
                                "HYDRITY (SALES DE REHIDRATACION ORAL)SACHET #1 (UNO)",
                                "CLODOPAN (METOCLOPRAMIDA HCL 2.6MG) GOTERO #1 (UNO)",
                                "6 COPIN (CLOROFENOTIAZINILCOPINA) GOTERO #1 (UNO)",
                                "VONAU FLASH (ONDANSETRON 8MG) COPRIMIDOS #4 (CUATRO)",
                                "VONAU FLASH (ONDANSETRON 4MG) COPRIMIDOS #4 (CUATRO)",
                                "TOPIDENT INFANTIL (YODURO 1.4GR + BENZOCAÍNA 1GR + SULTAFO DE ALUMINIO 2GR) SOLUCION BUCAL #1 (UNO)",
                                "TOPIDENT ADULTO (YODURO 1.4GR + BENZOCAÍNA 1GR + SULTAFO DE ALUMINIO 2GR) SOLUCION BUCAL #1 (UNO)",
                                "BUCAGEL (TRICLOSAN 0.20GR + ZINC 0.38GR + BENZOCAINA 3GR + GLUCONATO 1GR) GEL #1 (UNO)",
                                "ESOMAX (ESOMEPRAZOL 20MG) CAPSULAS #10 (DIEZ)",
                                "OMEZZOL FAST ( OMEPRAZOL 20 MG + SODIO BICARBONATO 1680 MG) POLVO PARA RECONSTITUIR SUSPENSION ORAL SOBRES #7 (SIETE)",
                                "AERO OM (SIMETICONA 100MG/ML) GOTERO #1 (UNO)",
                                "AERO OM (SIMETICONA 40MG) COMPRIMIDOS MASTICABLES #12 (DOCE)",
                                "BEVERIN RETARD (MEBEVERINA CLORHIDRATO 200MG) CAPSULAS #5 (CINCO)",
                                "MILPAX (ALGINATO DE SODIO 2.5GR + BICARBONATO DE SODIO 2.67GR/5ML) JARABE #1 (UNO)PEDIR",
                                "ACITIP ID (MAGALDRATO 800MG + DIMETICONA 100MG/10ML) GEL ORAL #1 (UNO)",
                                "MAGANYL (MAGALDRATO 800MG + SIMETICONA 60MG/10ML)JARABE#1 (UNO)",
                                "SISDIAL (CINITAPRIDA 1MG + SIMETICONA 200MG + PANCREATINA 100MG) TABLETAS #12 (DOCE)",
                                "PANCREOL FORTE(ENZIMAS DIGESTIVAS + SIMETICONA) CAPSULAS #12 (DOCE)",
                                "PANCREOL COMPUESTO(ENZIMAS DIGESTIVAS + SIMETICONA) CAPSULAS #12 (DOCE)",
                                "ACRONISTINA (NISTATINA 100.000 UI/ML) SUSPENSION #1 (UNO)",
                                "DEOFLORA (BACILLUS CLAUSII 2 BILLONES/5ML) AMPOLLETAS BEBIBLES #5 (CINCO)",
                                "DEOFLORA (BACILLUS CLAUSII 4 BILLONES/5ML) AMPOLLETAS BEBIBLES #5 (CINCO)",
                                "SECOHIDRAT 10 (RACECADOTRILO 10MG) SOBRES #6 (SEIS)",
                                "SECOHIDRAT 30 (RACECADOTRILO 30MG) SOBRES #4 (CUATRO)",
                                "SECOHIDRAT 100 (RACECADOTRILO 100MG) CAPSULAS #10 (DIEZ)",
                                "REBLAND (LACTULOSA 3.33GR/5ML) JARABE #1 (UNO)",
                                "NORMOLAX GOTAS (PICOSULFATO SODICO 14.49MG) GOTERO 15ML #1 (UNO)",
                                "PROCRESIL (POLICRESULENO 100 MG + CINCHOCAINA 2.5 MG)SUPOSITORIOS #5 (CINCO)",
                                "FLEET DE ENEMA PEDIATRICO #1 (UNO)",
                                "FLEET DE ENEMA ADULTOS #1 (UNO)",
                                "FAKTU (POLICRESULENO 5GR + CINCHOCAINA 1GR) CREMA 20GR #1 (UNA)"
                            ]
                        },
                        {
                            "categoria": "DERMATOLOGIA",
                            "productos": [
                                "AC LAC (ACIDO LACTICO 90GR) JABON #1 (UNO)",
                                "BETAMETASONA 0.05% CREMA 1 (UNO)",
                                "MIXDERM (CLOTRIMAZOL 1GR + BETAMETASONA 0.04GR +NEOMICINA0.5 G) CREMA 20GR #1 (UNA)",
                                "MOMETASONA FUROATO CREMA 0.1% 15 GRAMOS UNA (01)",
                                "TERBINAFINA CREMA AL 1% 20 GRAMOS UNA (01)",
                                "HISTACALM (ACETATO DE ZINC 0.12GR + TRAMOXINA 1.07GR + ALCANFOR 0.09GR) LOSION #1 (UNA)",
                                "NYSTASOLONA (DESONIDE-PREDNISOLONA 0.1%/NISTATINA 100.000 UI/G) CREMA #1 (UNA)",
                                "NEO – NYSTASOLONA (DESONIDE-PREDNISOLONA 0.1%/NISTATINA 100.000 UI/G + NEOMICINA BASE 5MG) CREMA #1 (UNA)",
                                "NISTADERM (OXIDO DE ZINC 40GR + NISTATINA 10.00.00 UI) CREMA #1 (UNA)",
                                "FUCICOR (ACIDO FUSIDICO 20MG + BETAMETASONA 1MG) CREMA#1 (UNA)",
                                "ACIDO FUSIDICO CREMA 2% TUBO DE 15 GRAMOS UNO (01)",
                                "MAXIDERM (DESONIDE-PREDNISOLONA 0.1%) CREMA #1 (UNA)",
                                "ROXICAINA (LIDOCAINA 5%) GEL #1 (UNO)",
                                "SULFADIAZINA DE PLATA 1% CREMA #1 (UNA)",
                                "MUPAX (MUPIROCINA 15MG) CREMA #1 (UNA)",
                                "ACICLOVIR (ACICLOVIR 5%) CREMA #1 (UNA)",
                                "GENTAMAX (GENTAMICINA 0.1%) CREMA #1 (UNA)",
                                "ALOAIR GEL (ALOE VERA) GEL #1 (UNO)",
                                "LAMODERM (NEOMICINA 0.712G/POLIMIXINA B100000UI/LIDOCAINA 4%) CREMA #1 (UNA)SPRAY ANTITRANSPIRANTE BMC SPRAY COLOCAR EN LAS MANOS EN LA MAÑANA Y NOCHE",
                                "URIAGE DESODORANTE URIAGE DESODORANTE COLOCAR EN AXILAS TODOS LOS DIAS",
                                "ACTIVA ANTICASPA CHAMPU ACTIVA ANTICASPA CHAMPU USAR PARA EL LAVADO DEL CUERO CABELLUDO DEJAR ACTUAR 3 MINUTOS Y ENJUAGAR ACTIVA ANTICASPA CHAMPU USAR PARA EL LAVADO DEL CUERO CABELLUDO DEJAR ACTUAR 3 MINUTOS Y ENJUAGAR"
                            ]
                        },
                        {
                            "categoria": "OFTALMOLOGIA",
                            "productos": [
                                "OFTAGEN (GENTAMICINA 0.3%) COLIRIO #1 (UNO)",
                                "TRAZIDEX (TOBRAMICINA 0.3% + DEXAMETASONA 0.15) UNGÜENTO OFTALMICO#1 (UNO)",
                                "TRAZIDEX OFTENO (TOBRAMICINA 0.3% + DEXAMETASONA 0.15) GOTERO OFTALMICO #1 (UNO)",
                                "FLUMETOL NF OFTTENO (ACETATO DE FLUOROMETALONA0.1%) SUSPENSION OFTALMICA #1 (UNA)"
                            ]
                        },
                        {
                            "categoria": "GINECOLOGIA",
                            "productos": [
                                "GESLUTIN–PNM (PROGESTERONA 200MG) TABLETAS #30 (TREINTA)HEMATOMAS PEDIR",
                                "CYTOTEC (MISOPROSTOL 200ugr) TABLETA SUBLINGUAL #3 (TRES)DOSIS UNICA",
                                "HEMOBLOCK (ACIDO TRANEXAMICO 500MG) TABLETAS #15 (QUINCE)SANGRADO VAGINAL",
                                "CERAZETTE (DESOGESTREL 0.075MG) CAJA #1 (UNO)",
                                "BELARA (CLORMADINONA ACETATO 2MG + ETENILESTRADIOL 0.03MG) BLISTER #1 (UNO)",
                                "EURA (NORELGESTRONICA/ETINILESTRADIO) PARCHE TRASNDERMICO CAJA UNMA (01)VIENE 3 PARCHES",
                                "SOLUNA 5 (NORESTITERONA 50MG + ESTADRIOL 5MG/ML) AMPOLLA #1 (UNA)",
                                "FLUCONACX (FLUCONAZOL 150MG) TABLETAS #4 (CUATRO)",
                                "RELAXATE (FLAVOXATO 200MG) TABLETAS #10 (DIEZ)",
                                "ACROMONA (METRONIDAZOL 500MG + NISTATINA 100000UI) OVULOS #7 (SIETE)",
                                "TRICOXIN (METRONIDAZOL 500MG + NISTATINA 20MG) OVULOS #7 (SIETE)",
                                "VAGIRAL (CLOTRIMAZOL 200MG) OVULOS #6 (SEIS)",
                                "CLOTRIMAZOL 1% CREMA 40GR #1 (UNA)",
                                "CLOTRIMAZOL 2% CREMA 20GR #1 (UNA)",
                                "CUTAMYCON (CLOTRIMAZOL 1%) CREMA 20GR #1 (UNA)",
                                "OVESTIN (ESTRIOL 1MG) CREMA VAGINAL #1 (UNA)",
                                "YODO POVIDYN 7.5% JABON LIQUIDO #1 (UNO)",
                                "ACIDO FOLICO 5 GRAMOS FRASCO #1 (UNO)",
                                "ACIDO FOLICO 1 GRAMOS FRASCO #1 (UNO)",
                                "CALM 5MG (SOLIFENACINA SUCCINATO) CAJA 1 (UNO)",
                                "SIMPAUSE (ISOFLAVONA DE SOYA 100MG ) CAJA #1 (UNA)MENOPAUSIA TTO DE 1-3 MESES",
                                "PRENAFER (HIERRO 30MG + ACIDO FOLICO 1000UG) CAJA #1 (UNA)",
                                "GELCAVIT NATAL (VIT A 4000UI + VIT D2 400UI + VIT B1 2MG + VITB2 3MG + VIT B6 2MG + VIT B12 6UG + HIERRO 30MG) CAJA #1 (UNA)",
                                "LAFEM BIO DEFENSE SOLUCION #1 (UNA)",
                                "PH LAC (ACIDO LACTICO + LACTOSUERO) SOLUCION #1 (UNA)"
                            ]
                        },
                        {
                            "categoria": "COLESTEROL y TRIGLICERIDOS",
                            "productos": [
                                "SIMVASTATINA 40MG TABLETAS #30 (TREINTA)",
                                "LIPOBRAND (CIPROFIBRATO 100MG) TABLETAS #30 (TREINTA)",
                                "OMACOR (OMEGA 3 1000MG + AC. DOCOSAHEXANOICO 280MG + TOCOFEROL 4MG) CAPSULAS CAJA #1 (UNA)",
                                "ALOPURINOL 300MG COMPRIMIDOS #30(TREINTA)"
                            ]
                        },
                        {
                            "categoria": "ENDOCRINOLOGIA",
                            "productos": [
                                "GLUCOCID 500 (METFORMINA 500MG) TABLETAS #30 (TREINTA)",
                                "GLUCOCID 1000 (METFORMINA 1000MG) TABLETAS #30 (TREINTA)"
                            ]
                        },
                        {
                            "categoria": "VITAMINAS PEDIATRICOS",
                            "productos": [
                                "FORTICHEN (MULTIVITAMINAS) GOTERO #1 (UNO)",
                                "FORTICHEN (MULTIVITAMINAS + MINERALES) JARABE #1 (UNO)",
                                "ABECIDIN (VITAMINA A, VITAMINA C, VITAMINA D3) GOTERO UNO (01)",
                                "FERROMALT (HIERRO III POLIMALTOSADO 50MG/ML) GOTERO 30ML #1 (UNO)",
                                "APEVITIN (CLORHIDRATO DE CIPROHEPTADINA+ VITAMINA B Y C) JARABE #1 (UNO)",
                                "HAPECO (VIT A + VIT B + VIT C + ZINC) JARABE 120 ML #1 (UNO)",
                                "HAPECO (VIT A + VIT B + VIT C + VIT D+ VIT E) GEL 100 G #1 (UNO",
                                "COMPLEJO B (MULTIVITAMINAS) JARABE UNO (01) 3",
                                "APETITOL (TIAMINA 2MG + RIBOFLAVINA 1.5MG + NICOTINAMIDA 15MG + PIRIDOXINA 2MG) GOTERO #1 (UNO)",
                                "APETITOL INFANTIL (TIAMINA 0.75MG + RIBOFLAVINA 1MG + NICOTINAMIDA 10MG + PIRIDOXINA 1MG) JARABE #1 (UNO)2 a 5 AÑOS",
                                "APETITOL PLUS (TIAMINA 1.5MG + RIBOFLAVINA 1.2MG + NICOTINAMIDA 20MG + PIRIDOXINA 2MG) JARABE #1 (UNO)6 AÑOS EN ADELANTE",
                                "NUTRIBIO KIDS (VIT. A 0.20MG + B1 0.35MG + B20.40MG + B6 0.50MG + NICOTINAMIDE4.50 MG + VIT. C 20MG + VITD 20.005) JALEA #1 (UNO)",
                                "NESTUM 8 CEREALES CON QUINUA CAJA UNA (01) A PARTIR DE LOS 9 MESES",
                                "NESTUM 5 CEREALES CON QUINUA CAJA UNA (01) A PARTIR DE LOS 6 MESES",
                                "NESTUM CEREAL INFNTIL CON ARROZ CAJA UNA (01) A PARTIR DE LOS 6 MESES",
                                "PEDIASURE (PROTEINAS + VITAMINA K1 y K2 + CALCIO + ARGININA + MINERALES) TARRO #1 (UNO)",
                                "ASCENDA SUPLEMENTO INFANTIL 400 GRAMOS TARRO UNO (01)"
                            ]
                        },
                        {
                            "categoria": "VITAMINAS ADULTOS",
                            "productos": [
                                "NERVINETAS (RAIZ DE VALERIANA 187.5MG + LUPULO 45MG) CAJA #1 (UNA)",
                                "NUTRIBIO INMUNO (GLUCOMANANO 100MG + CALCIO 500MG + ZINC) CAJA #1 (UNA)",
                                "FERROMALT (HIERRO III POLIMALTOSADO 100MG/5ML) AMPOLLAS BEBIBLES CAJAS DE 10 UNIDADES #3 (TRES)",
                                "GELCAVIT STUDENTS (MULTIVITAMINAS + HIERRO 5MG + POTASIO 2MG + ZINC 2MG + FOSFORO 169MG) CAJA #1 (UNA)",
                                "RECORDERIS (VIT A 900MCG + VIT B1 2MG + VIR B2 2MG + VIT B6 1.5MG + VIT C 60MG + VIT D 10MCG + VIT E 12 MG + NIACINA 20MG + CALCIO 250MG + FOSFORO 130MG + MG 250MG) COMPRIMIDOS #30 (TREINTA)",
                                "IMMUVIT PLUS Q10 (BETACAROTENO 25MIL UI + COENZIMA Q10 20MG + GINSENG 80MG + VITAMINA C 120MG + VITAMINA D3 400UI + VITAMINA E 90UI) CAJA #1 (UNA)",
                                "HEPASIL (SILIMARINA 150MG + COENZIMA Q10 50MG + VITAMINA B1 + VITAMINA B6 + ACIDO FOLICO + VITAMINA E) CAPSULAS #30 (TREINTA)",
                                "NEURAL PLUS (TIAMINA 50MG + PIRIDOXINA 50MG + CIANOCOBALAMINA 1MG + DICLOFENACO 50MG) CAJA #1 (UNA)",
                                "DOLO NEUROBION RETARD (DICLOFENACO 100MG + TIAMINA 100MG + PIRIDOXINA 100MG + CIANOCOBALAMINA 1MG) TABLETAS #10 (DIEZ)",
                                "DOLO NEUROBION FORTE (DICLOFENACO 50MG + TIAMINA 100MG + PIRIDOXINA 100MG + CIANOCOBALAMINA 1MG) TABLETAS #10 (DIEZ)"
                            ]
                        },
                        {
                            "categoria": "OTROS",
                            "productos": [
                                "PRESACOR (PREDNISONA 20MG) TABLETAS #10 (DIEZ)",
                                "BETASERC OD (BETAHISTINA 48MG) COMPRIMIDOS #4 (CUATRO)",
                                "BETASERC (BETAHISTINA 24MG) COMPRIMIDOS #8 (OCHO)",
                                "ANAUTIN (DIMENHIDRINATO 50MG) TABLETAS #8 (OCHO)",
                                "BUCLIXIN (BUCLIZINA CLORHIDRATO 25MG) TABLETAS #8 (OCHO)",
                                "OTODYNE (FENAZONA 5.4GR + BENZOCAINA 1.4GR) SOLUCION OTICA #1 (UNA)",
                                "OTOZAMBON (FLUORHIDROCORTISONA 0.1GR + NEOMICINA 0.712GR + POLIMIXINA + LIDOCAINA 4GR) GOTERO#1 (UNO)",
                                "ZOPICLONA 7,5 MG TABLETAS #10 (DIEZ)",
                                "REPELENTE SPRAY #1 (UNO)"
                            ]
                        },
                        {
                            "categoria": "NEBULIZACIONES",
                            "productos": [
                                "DEXAMETASONA 4MG AMPOLLAS #3 (TRES)",
                                "DEXAMETASONA 4MG AMPOLLAS #6 (SEIS)",
                                "DEXAMETASONA 8MG AMPOLLAS #6 (SEIS)",
                                "FLUIMUCIL (ACETILCISTEINA 300MG) AMPOLLAS #3 (TRES)",
                                "FLUIMUCIL(ACETILCISTEINA 300MG) AMPOLLAS #6 (SEIS)",
                                "COMBIVENT (BROMURO DE IPATROPIO + SALBUTAMOL) AMPOLLAS #3 (TRES)"
                            ]
                        },
                        {
                            "categoria": "LECHES",
                            "productos": [
                                "S26 GOLD ETAPA 1 TARRO #1 (UNO)0 a 6 MESES",
                                "PROGRESS GOLD ETAPA 3 TARRO #1 (UNO)A PARTIR DE UN AÑO",
                                "NUTRI BABY PREMATUROS (FORMULAS INFANTILES PREMIUM) TARRO 400G#1 (UNO)PREMATUROS",
                                "NUTRI BABY BAJA LACTOSA (FORMULAS INFANTILES PREMIUM) TARRO #1 (UNO)DESDE EL NACIMIENTO",
                                "NUTRI BABY 2 (FORMULAS INFANTILES PREMIUM) TARRO 400GR#1 (UNO)DE 6-12 MESES",
                                "NUTRI BABY 3 (FORMULAS INFANTILES PREMIUM) TARRO 400GR#1 (UNO)MAYORES DE 1 AÑO",
                                "NUTRI BABY 4 (FORMULAS INFANTILES PREMIUM) TARRO 400GR #1 (UNO)MAYORES DE 3 AÑOS",
                                "NUTRI BABY BIENESTAR 400 G (FORMULA INFANTIL PREMIUM) TARRO #1 (UNO)",
                                "NUTRIBIO KIDS PREMIUM (FORMULAS INFANTILES PREMIUM) TARRO 400GR#1 (UNO)DE 1-10 AÑOS",
                                "FONTACTIV JUNIOR (SUPLEMENTO ALIMENTICIO)TARRO 400GR#1 (UNO)DE 1-14 AÑOS",
                                "NUTRIBIO PREMIUM (FORMULA COMPLEMENTARIA PREMIUM) TARRO 400GR#1 (UNO)APRTIR DE LOS 10 AÑOS Y ADULTOS",
                                "FONTACTIV COMPLETE(SUPLEMENTO ALIMENTICIO) TARRO 400GR#1 (UNO)APARTIR DE LOS 14 AÑOS Y ADULTOS"
                            ]
                        }
                    ],
                    "indicaciones_y_tratamientos": {
                        "instrucciones_generales": [
                            "INTERCALAR LOS DIAS",
                            "ML 6AM 2PM 10PM",
                            "ML 10AM 6PM 2AM",
                            "LOS DIAS",
                            "ML CADA 8 HORAS DESPUES DE LAS COMIDAS PRINCIPALES",
                            "ML CADA 6 HORAS (6AM-12PM-6PM-10PM)",
                            "DIETA FRACCIONADA 5 VECES AL DIA",
                            "DESAYUNO 10 FRUTA + ALMUERZO 4:30 FRUTA O CHOCHOS O YOGURT + CENA (NO GRANOS NI CARNES ROJAS)",
                            "COMPRESAS CON AGUA DE MANZANILLA Y SAL EN GRANO, COLOCAR 2 VECES AL DIA POR 3 DIAS",
                            "15 MINUTOS COMPRESAS TIBIA, 5 MINUTOS DESCANSAR, 10 MINUTOS COMPRESAS FRIA"
                        ],
                        "respiratorios": {
                            "indicaciones": [
                                "DESCANSO DE LA VOZ",
                                "LIQUIDOS ABUNDANTES AL CLIMA",
                                "EVITAR CAMBIOS BRUSCOS DE TEMPERATURA",
                                "GARGARAS CON AGUA DE MANZANILLA + PIZCA DE BICARBONATO 2 VECES AL DIA"
                            ],
                            "signos_de_alarma": "FIEBRE QUE NO SE CONTROLE, TOS QUE EMPEORE, RONQUIDO DE PECHO, VOMITE (REGRESAR URGENTE)"
                        },
                        "gastrointestinales": {
                            "indicaciones": [
                                "LIQUIDOS ABUNDANTES",
                                "DIETA BLANDA LIBRE DE LACTEOS",
                                "NO HUEVO, NO ENLATADOS, NO SARDINA, NO ATUN, NO EMBUTIDOS, NO GASEOSAS",
                                "PUEDE SOPA DE POLLO SIN PIEL, CARNE O POLLO A LA PLANCHA, PURE DE PAPA, COLADA DE GUAYABA Y MANZANA SIN LECHE"
                            ],
                            "signos_de_alarma": "DOLOR ABDOMINAL INTENSO, FIEBRE, DIARREA CON SANGRE (REGRESAR URGENTE)"
                        },
                        "gastritis_pirosis": {
                            "indicaciones": [
                                "NO ACIDOS, NI GASEOSAS, NI COLORANTES",
                                "5 COMIDAS AL DIA: 3 PRINCIPALES 7 AM 1PM 7 PM, 2 REFRIGERIOS 10AM 4PM",
                                "PUEDE TOMAR LECHE DE ALMENDRA",
                                "EVITAR GRASAS, COMIDAS FRITAS, O RECALENTADAS",
                                "EVITAR CAFÉ NEGRO O TÉ",
                                "NO CONDIMENTAR MUCHO LA COMIDA"
                            ]
                        },
                        "tratamientos_helicobacter_pylori": [
                            {
                                "nombre": "PACK TRIGASTRO",
                                "dosis": [
                                    "ESOMAX TOMAR UNA CÁPSULA CADA 12 HORAS (30 MINUTOS ANTES DEL DESAYUNO Y 30 MINUTOS ANTES DE LA CENA)",
                                    "ACROMOX TOMAR UN COMPRIMIDO CADA 12 HORAS (DESPUÉS DEL DESAYUNO Y DESPUÉS DE LA CENA)",
                                    "LALEVO TOMAR UN COMPRIMIDO DESPUES DEL ALMMUERZO"
                                ]
                            },
                            {
                                "nombre": "HELICOPACK",
                                "dosis": [
                                    "OMECIDOL TOMAR UNA CÁPSULA CADA 12 HORAS (30 MINUTOS ANTES DEL DESAYUNO Y 30 MINUTOS ANTES DE LA CENA) POR 7 DIAS",
                                    "XILIN TOMAR UN COMPRIMIDO CADA 12 HORAS (DESPUÉS DEL DESAYUNO Y DESPUÉS DE LA CENA) POR 7 DIAS",
                                    "FASDAL TOMAR UN COMPRIMIDO UNA VEZ AL DÍA DESPUES DEL ALMUERZO POR 7 DIAS"
                                ]
                            },
                            {
                                "nombre": "TRATAMIENTO ACTUAL H PYLORI",
                                "dosis": [
                                    "OMEPRAZOL TOMAR 1 COMPRIMIDO VIA ORAL 30 MINUTOS ANTES DEL DESAYUNO Y 30 MINUTOS ANTES DE LA CENA POR 14 DIAS",
                                    "BISMUTOL TOMAR 1 CUCHARADA VIA ORAL CADA 6 HORAS 6-12-6-10 POR 14 DIA",
                                    "TETRACICLINA TOMAR 1 COMPRIMIDO VIA ORAL CADA 6 HORAS 6-12-6-10 POR 14 DIAS",
                                    "METRONIDAZOL TOMAR 1 COMPRIMIDO VIA ORAL CADA 8 HORAS DESPUES DE LAS COMIDAS PRINCIPALES POR 14 DIAS"
                                ]
                            }
                        ],
                        "paralisis_de_bell": {
                            "ejercicios_faciales": [
                                "ELEVAR UNA CEJA Y LUEGO ALTERNAR",
                                "SONREIR CON LABIOS CERRADOS",
                                "FRUNCIR EL CEÑO Y ARRUGAR LA NARIZ",
                                "ENTRECERRAR LOS OJOS",
                                "ARRUGAR LA NARIZ",
                                "APRETAR EL MENTÓN",
                                "JUNTAR LOS DIENTES MIENTRAS SE ABREN LOS LABIOS",
                                "IMITAR EL MOVIMIENTO DE SILBAR",
                                "ELEVAR AMBAS CEJAS, CON EXPRESIÓN DE SORPRESA",
                                "ABRIR LAS ALETAS NASALES",
                                "SONREIR CON LOS LABIOS ABIERTOS",
                                "ELEVAR LA NARIZ CON EXPRESIÓN DE MOLESTO",
                                "DEPRIMIR LOS LABIOS EN SEÑAL DE TRISTEZA"
                            ]
                        },
                        "tratamiento_parasikit": {
                            "dosis": [
                                "DIA 1: ALBENDAZOL: TOMAR 1 COMPRIMIDO VIA ORAL DESPUES DEL DESAYUNO",
                                "DIA 2: SECNIDAZOL: TOMAR 2 COMPRIMIDOS VIA ORAL DESPUES DEL DESAYUNO",
                                "ESPERAR 3 DIAS Y COMENZAR"
                            ]
                        },
                        "otros_signos_de_alarma": [
                            {
                                "condicion": "EMBARAZO",
                                "sintomas": "DOLOR ABDOMINAL INTENSO, SANGRADO VAGINAL, SECRECION VAGINAL AUMENTE Y SEA DE MAL OLOR, DOLOR PELVICO INTENSO, VOMITO QUE PERSISTA, SALIDA DE LIQUIDO POR VAGINAL (REGRESAR URGENTE)"
                            },
                            {
                                "condicion": "OTITIS",
                                "sintomas": "DOLOR INTENSO DE OIDO, SALIDA DE PUS O SANGRE POR EL OIDO, FIEBRE (REGRESAR URGENTE)"
                            },
                            {
                                "condicion": "DIARREAS",
                                "sintomas": "DOLOR ABDOMINAL INTENSO, DIARREA CON SANGRE, FIEBRE QUE NO SE CONTROLE, VOMITO (REGRESAR URGENTE)"
                            }
                        ]
                    },
                    "especialistas_externos_mencionados": [
                        {
                            "especialidad": "NEUROLOGIA",
                            "nombre": "DR. GONZALO HERRERA",
                            "contacto": "2372 200 / 0999921501",
                            "ubicacion": "CENTRO MEDICO TUMBACO, GONZALO DE VERA OE1 – 133, ENTRE ESPEJO Y PIZARRO"
                        },
                        {
                            "especialidad": "NEUROPEDIATRA",
                            "nombre": "ANDRES HERRERA",
                            "contacto": "0998236960"
                        },
                        {
                            "especialidad": "CIRUGIA VASCULAR",
                            "nombre": "DR. JUAN CARLOS ANDRADE",
                            "contacto": "0987610997",
                            "ubicacion": "CONSULTORIO MEDICO VASCULAR MEDIVASC, TUMBACO – VICENTE ROCAFUERTE N1-162 Y ABDON CALDERON"
                        },
                        {
                            "especialidad": "CIRUGIA GENERAL",
                            "nombre": "DR. GIOVANNY ALMACHI",
                            "contacto": "0984470154",
                            "ubicacion": "HOSPITAL DEL DIA SAN FERNANDO, CALDERON, CARAPUNGO JAIME ROLDOS AGUILERA / JERONIMO CARRION"
                        },
                        {
                            "especialidad": "ENDOSCOPIAS",
                            "ubicacion": "CLINICA DE ESPECIALIDADES TUMBACO",
                            "contacto": "2376058 / 0999447642",
                            "detalles": "REALIZAN ENDOSCOPIAS LOS DIAS MARTES JUEVES Y SABADO. COSTO:$155+ BIOPSIA INCLUIDA"
                        },
                        {
                            "especialidad": "CARDIOLOGIA",
                            "nombre": "DR ALVARO VILLACRES",
                            "contacto": "0984967724",
                            "detalles": "SECRE MERCEDES 0960478626"
                        },
                        {
                            "especialidad": "OTORRINOLARINGOLOGA",
                            "nombre": "DRA MARIA LORENA ARELLANO",
                            "contacto": "0998311271"
                        }
                    ]
                }
            }
        ]
    },

    // 3. ESTADO DEL SISTEMA (Variables en Memoria)
    usuarioActual: null // Se llenará cuando el usuario inicie sesión
};

// ==========================================================================
// FUNCIÓN DE INICIALIZACIÓN DE LA BASE DE DATOS LOCAL
// ==========================================================================
function inicializarBaseDeDatos() {
    if (!localStorage.getItem('sanitasFam_db')) {
        // Si no existe, guarda los datos iniciales en el LocalStorage
        localStorage.setItem('sanitasFam_db', JSON.stringify(datosIniciales));
        console.log("Base de datos del Centro Médico inicializada en LocalStorage.");
    } else {
        console.log("Base de datos existente conectada.");
    }
}

// Ejecutar al cargar el script
inicializarBaseDeDatos();