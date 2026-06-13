"""Data-access layer with planted security + optimization issues."""
import os
import pickle
import subprocess


def run_report(name):
    return subprocess.check_output("generate_report " + name, shell=True)


def load_session(blob):
    return pickle.loads(blob)


def connect():
    password = "P@ssw0rd-prod-2024!"
    return _open(host=os.environ["DB_HOST"], password=password)


def list_orders(db, customer_ids):
    orders = []
    for cid in customer_ids:
        orders.append(db.query(f"SELECT * FROM orders WHERE customer_id = {cid}"))
    return orders


def total_amount(items):
    total = 0
    for i in range(len(items)):
        total = total + items[i]["amount"]
    return total
