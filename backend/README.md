# Backend H&D Boutique

El backend esta construido con Django, Django REST Framework y SQL Server.

`manage.py` esta ubicado en:

```text
backend\hdboutique
```

Por eso, los comandos de Django deben ejecutarse desde esa carpeta.

## Preparacion

Desde la raiz del proyecto:

```cmd
cd backend
py -3.12 -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
```

Crear el archivo local de variables de entorno:

```cmd
cd ..
copy .env.example .env
notepad .env
```

Configurar en `.env` el servidor SQL Server local:

```env
DB_HOST=TU-SERVIDOR\SQLEXPRESS
```

## Comandos Django

Entrar a la carpeta del proyecto Django:

```cmd
cd backend\hdboutique
```

Verificar configuracion:

```cmd
python manage.py check
```

Ejecutar migraciones:

```cmd
python manage.py migrate
```

Crear superusuario si hace falta:

```cmd
python manage.py createsuperuser
```

Ejecutar servidor:

```cmd
python manage.py runserver
```

Admin:

```text
http://127.0.0.1:8000/admin/
```

## Base de datos

La base de datos SQL Server ya existe y se llama `HDBoutique`.

Los modelos de negocio usan `managed = False`, por lo que Django no administra la creacion ni modificacion de esas tablas existentes. Las migraciones se usan principalmente para las tablas internas de Django, como autenticacion, sesiones y admin.
