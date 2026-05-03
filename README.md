<<<<<<< HEAD
# H&D Boutique

Sistema web administrativo local para la tienda familiar H&D Boutique.

Este proyecto no es una tienda online publica. Su objetivo es administrar inventario, compras, ventas, proveedores, clientes, empleados y otros procesos internos de la tienda.

## Tecnologias

- Backend: Python + Django
- API: Django REST Framework
- Base de datos: SQL Server existente
- Driver SQL Server: ODBC Driver 17 for SQL Server
- Frontend: React pendiente de iniciar
- Sistema operativo principal: Windows
- Control de versiones: Git + GitHub privado

## Requisitos

- Python 3.12 recomendado
- Git
- SQL Server instalado localmente
- Base de datos existente llamada `HDBoutique`
- ODBC Driver 17 for SQL Server
- Visual Studio Code opcional

Cada colaborador puede tener un nombre de servidor SQL Server diferente. Ese dato se configura en el archivo local `.env`, que no se sube a GitHub.

## Instalacion en Windows

Clonar el repositorio privado:

```cmd
git clone URL_DEL_REPOSITORIO
cd WebHDBoutique
```

Crear el entorno virtual:

```cmd
cd backend
py -3.12 -m venv venv
```

Activar el entorno virtual:

```cmd
venv\Scripts\activate
```

Instalar dependencias:

```cmd
pip install -r requirements.txt
```

Crear el archivo `.env` desde la plantilla:

```cmd
cd ..
copy .env.example .env
notepad .env
```

En `.env`, cada colaborador debe cambiar principalmente `DB_HOST` por el nombre de su propio servidor SQL Server local.

Ejemplos:

```env
DB_HOST=MI-PC\SQLEXPRESS
DB_HOST=EQUIPO-COLABORADOR\SQLEXPRESS
```

Para autenticacion de Windows se mantiene:

```env
DB_TRUSTED_CONNECTION=yes
```

## Ejecutar el backend

Los comandos de Django se ejecutan desde:

```cmd
backend\hdboutique
```

Entrar a la carpeta:

```cmd
cd backend\hdboutique
```

Verificar la configuracion:

```cmd
python manage.py check
```

Ejecutar migraciones de Django:

```cmd
python manage.py migrate
```

Levantar el servidor local:

```cmd
python manage.py runserver
```

Abrir en el navegador:

```text
http://127.0.0.1:8000/
```

Admin de Django:

```text
http://127.0.0.1:8000/admin/
```

Si no existe un usuario administrador, crearlo con:

```cmd
python manage.py createsuperuser
```

## Archivos que no deben subirse a GitHub

No subir archivos locales o sensibles como:

- `backend/venv/`
- `.env`
- `__pycache__/`
- archivos `.pyc`
- logs
- bases SQLite locales
- archivos temporales
- `node_modules/` cuando exista el frontend
- configuraciones privadas del editor

El repositorio si debe incluir:

- `.env.example`
- `backend/requirements.txt`
- codigo fuente del backend
- documentacion del proyecto

## Comandos para preparar el primer push

Despues de revisar los cambios:

```cmd
git status
git add .
git commit -m "Preparar proyecto para trabajo colaborativo"
git remote add origin URL_DEL_REPOSITORIO_PRIVADO
git branch -M main
git push -u origin main
```

Si `origin` ya existe, revisar con:

```cmd
git remote -v
```

Y cambiarlo si fuera necesario:

```cmd
git remote set-url origin URL_DEL_REPOSITORIO_PRIVADO
```

## Flujo para colaboradores

Cada colaborador debe:

1. Clonar el repositorio privado.
2. Crear su propio entorno virtual en `backend/venv`.
3. Instalar dependencias con `pip install -r requirements.txt`.
4. Copiar `.env.example` como `.env`.
5. Editar `DB_HOST` con el nombre de su SQL Server local.
6. Confirmar que existe la base de datos `HDBoutique`.
7. Ejecutar `python manage.py check`.
8. Ejecutar `python manage.py migrate`.
9. Levantar el servidor con `python manage.py runserver`.

Nunca deben subir su archivo `.env`.
=======
# HDboutique
Aqui vamos a subir los avances de cada uno, lo bueno de cada es que para evitar dependencias, servidores locales, vamos a crear archivos para que se instalen de inmediato, y cada quien trabaja desde su maquina local
>>>>>>> 35b066f18c8b25d9b11b10b6ae332173005482d2
